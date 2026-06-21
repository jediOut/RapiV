import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "node:crypto";
import { DataSource, EntityManager, Repository } from "typeorm";

import { BusinessesService } from "../businesses/businesses.service";
import { NotificationsService } from "../notifications/notifications.service";

import type { LocationDto } from "../../common/geo/location.dto";
import { Product } from "../products/product.entity";
import { User } from "../users/user.entity";
import type { CreateOrderDto } from "./dto/create-order.dto";
import type { UpdateCourierAvailabilityDto } from "./dto/update-courier-availability.dto";
import { DeliveryOffer } from "./delivery-offer.entity";
import { OrderItem } from "./order-item.entity";
import { OrderProcessingQueue } from "./order-processing.queue";
import { Order } from "./order.entity";
import type {
  BusinessOrder,
  BusinessOrderStatus,
  OrderGroup,
  OrderGroupStatus,
  OrderItemSnapshot
} from "./order.entity";
import { Business } from "../businesses/business.entity";
import { CourierProfile } from "../users/courier-profile.entity";
import { assertInsideVegaServiceaddress } from "src/common/geo/vega-zone";
import { MonitoringService } from "../monitoring/monitoring.service";
import { Payment } from "../payments/payment.entity";
import { PaymentProcessingQueue } from "../payments/payment-processing.queue";
import { PaymentProviderService, ProviderTransfer } from "../payments/payment-provider.service";
import { CourierWalletService } from "../payments/courier-wallet.service";
import { StripeConnectService } from "../stripe-connect/stripe-connect.service";
import type { OrderLifecycleJob } from "./order-processing.queue";

export type DeliveryOfferSummary = {
  id: string;
  status: string;
  score: number;
  expiresAt: Date;
  order: OrderGroup;
};

type ProcessableBusinessOrderNotification = Pick<
  Order,
  "id" | "orderGroupId" | "businessId" | "subtotalCents"
>;

type CustomerStatusNotification = {
  userId: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
};

@Injectable()
export class OrdersService {
  private readonly pendingCreations = new Map<string, Promise<OrderGroup>>();
  private readonly activeCourierDeliveryStatuses = new Set<string>([
    "ASSIGNED",
    "PARTIALLY_PICKED_UP",
    "PICKED_UP",
    "ON_THE_WAY"
  ]);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(DeliveryOffer)
    private readonly deliveryOfferRepository: Repository<DeliveryOffer>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(CourierProfile)
    private readonly courierProfileRepository: Repository<CourierProfile>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly dataSource: DataSource,
    private readonly businessesService: BusinessesService,
    private readonly orderProcessingQueue: OrderProcessingQueue,
    private readonly notificationsService: NotificationsService,
    private readonly paymentProviderService: PaymentProviderService,
    private readonly paymentProcessingQueue: PaymentProcessingQueue,
    private readonly stripeConnectService: StripeConnectService,
    private readonly courierWalletService: CourierWalletService,
    @Optional()
    private readonly monitoring?: MonitoringService
  ) { }

  async create(
    customerId: string,
    idempotencyKey: string | undefined,
    dto: CreateOrderDto
  ): Promise<OrderGroup> {
    const normalizedIdempotencyKey = idempotencyKey?.trim();

    if (!normalizedIdempotencyKey) {
      throw new BadRequestException("Idempotency-Key header is required");
    }

    const existingOrder = await this.orderRepository.findOne({
      where: { userId: customerId, idempotencyKey: normalizedIdempotencyKey }
    });

    if (existingOrder?.orderGroupId) {
      return this.findById(existingOrder.orderGroupId);
    }

    const indexKey = `${customerId}:${normalizedIdempotencyKey}`;
    const pendingCreation = this.pendingCreations.get(indexKey);

    if (pendingCreation) {
      return pendingCreation;
    }

    const creation = this.createPersistedOrderGroup(customerId, normalizedIdempotencyKey, dto)
      .finally(() => {
        this.pendingCreations.delete(indexKey);
      });

    this.pendingCreations.set(indexKey, creation);
    this.monitoring?.recordOrderEvent("create_requested", {
      customerId,
      itemCount: dto.items.length
    });
    return creation;
  }

  private async createPersistedOrderGroup(
    customerId: string,
    idempotencyKey: string,
    dto: CreateOrderDto
  ): Promise<OrderGroup> {

    const fulfillmentMethod = dto.fulfillmentMethod ?? "DELIVERY";

    if (fulfillmentMethod === "DELIVERY" && dto.latitude !== undefined && dto.longitude !== undefined) {
      assertInsideVegaServiceaddress({
        latitude: dto.latitude,
        longitude: dto.longitude
      });
    }

    try {
      const orderGroup = await this.dataSource.transaction(async (manager) => {

        const existingOrder = await manager.findOne(Order, {
          where: { userId: customerId, idempotencyKey }
        });

        if (existingOrder?.orderGroupId) {
          return this.loadOrderGroup(existingOrder.orderGroupId, manager);
        }

        const businessOrderItems = new Map<string, OrderItemSnapshot[]>();

        for (const item of dto.items) {
          const product = await manager.findOne(Product, {
            where: { id: item.productId },
            relations: ["business"]
          });

          if (!product) {
            throw new NotFoundException("Product not found");
          }

          if (!product.available) {
            throw new ConflictException(`Product ${product.id} is not available`);
          }

          if (!product.business?.isOpen) {
            throw new ConflictException(`Business ${product.businessId} is closed`);
          }

          const minimumQuantity = product.minimumQuantityPerOrder ?? 1;
          if (item.quantity < minimumQuantity) {
            throw new ConflictException(
              `${product.name} requires at least ${minimumQuantity} per order`
            );
          }

          const unitPriceCents = Number(product.priceCents);
          const lineItem: OrderItemSnapshot = {
            productId: product.id,
            productName: product.name,
            quantity: item.quantity,
            unitPriceCents,
            lineTotalCents: unitPriceCents * item.quantity,
            minimumQuantityPerOrder: minimumQuantity
          };

          const items = businessOrderItems.get(product.businessId) ?? [];
          items.push(lineItem);
          businessOrderItems.set(product.businessId, items);
        }

        const orderGroupId = randomUUID();
        let shouldStoreIdempotencyKey = true;
        const paymentMethod = dto.paymentMethod ?? "CARD";
        let shouldAttachDeliveryFinancials = fulfillmentMethod === "DELIVERY";
        const deliveryFeeCents = fulfillmentMethod === "DELIVERY" ? this.deliveryFeeCents() : 0;
        const courierPayoutCents = fulfillmentMethod === "DELIVERY" ? this.courierPayoutCents() : 0;
        const platformDeliveryMarginCents = deliveryFeeCents - courierPayoutCents;
        const businessCommissionBps = this.platformFeeBasisPoints(paymentMethod);
        const orderSubtotalCents = [...businessOrderItems.values()]
          .flat()
          .reduce((sum, item) => sum + item.lineTotalCents, 0);

        this.assertCardPaymentMinimum(paymentMethod, orderSubtotalCents);

        for (const [businessId, items] of businessOrderItems.entries()) {

          const business = await manager.findOne(Business, {
            where: { id: businessId }
          });
          if (!business) {
            throw new NotFoundException("Business not found");
          }

          this.assertBusinessCheckoutRules(business, paymentMethod);

          const subtotalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
          const businessCommissionCents = Math.floor((subtotalCents * businessCommissionBps) / 10_000);
          const businessPayoutCents = subtotalCents - businessCommissionCents;
          const order = manager.create(Order, {
            userId: customerId,
            businessId,
            orderGroupId,
            idempotencyKey: shouldStoreIdempotencyKey ? idempotencyKey : null,
            status: "PENDING",
            paymentMethod,
            fulfillmentMethod,
            subtotalCents,
            deliveryFeeCents: shouldAttachDeliveryFinancials ? deliveryFeeCents : 0,
            courierPayoutCents: shouldAttachDeliveryFinancials ? courierPayoutCents : 0,
            courierPayoutStatus: shouldAttachDeliveryFinancials && courierPayoutCents > 0 ? "PENDING" : "NOT_APPLICABLE",
            platformDeliveryMarginCents: shouldAttachDeliveryFinancials ? platformDeliveryMarginCents : 0,
            businessCommissionCents,
            businessPayoutCents,
            businessCashPayoutStatus:
              paymentMethod === "CASH" &&
                fulfillmentMethod === "PICKUP" &&
                businessPayoutCents > 0
                ? "PENDING"
                : "NOT_APPLICABLE",
            totalPrice: (subtotalCents + (shouldAttachDeliveryFinancials ? deliveryFeeCents : 0)) / 100,
            deliveryAddress: dto.deliveryAddress.trim(),
            customerLatitude: fulfillmentMethod === "DELIVERY" ? dto.latitude : null,
            customerLongitude: fulfillmentMethod === "DELIVERY" ? dto.longitude : null,
            businessLatitude: business.latitude,
            businessLongitude: business.longitude,
            businessAddress: business.address,
            items: items.map((item) =>
              manager.create(OrderItem, {
                productId: item.productId,
                productName: item.productName,
                price: item.unitPriceCents,
                quantity: item.quantity
              })
            )
          });

          shouldStoreIdempotencyKey = false;
          shouldAttachDeliveryFinancials = false;
          await manager.save(Order, order);
        }

        const orderGroup = await this.loadOrderGroup(orderGroupId, manager);
        if (paymentMethod === "CASH") {
          for (const businessOrder of orderGroup.businessOrders) {
            await this.orderProcessingQueue.addBusinessAcceptanceTimeout(orderGroupId, businessOrder.id);
          }
        }
        this.monitoring?.recordOrderEvent("created", {
          orderGroupId,
          customerId,
          businessOrderCount: orderGroup.businessOrders.length,
          totalCents: orderGroup.totalCents
        });
        return orderGroup;
      });

      if (orderGroup.paymentMethod === "CASH") {
        await this.notifyBusinessesProcessableOrders(orderGroup.businessOrders);
      }

      return orderGroup;
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const existingOrder = await this.orderRepository.findOne({
          where: { userId: customerId, idempotencyKey }
        });

        if (existingOrder?.orderGroupId) {
          return this.findById(existingOrder.orderGroupId);
        }
      }

      throw error;
    }
  }

  async findById(orderGroupOrOrderId: string): Promise<OrderGroup> {
    const rootOrder = await this.orderRepository.findOne({
      where: { orderGroupId: orderGroupOrOrderId }
    });

    if (rootOrder) {
      return this.loadOrderGroup(rootOrder.orderGroupId);
    }

    const subOrder = await this.orderRepository.findOne({
      where: { id: orderGroupOrOrderId }
    });

    if (!subOrder?.orderGroupId) {
      throw new NotFoundException("Order not found");
    }

    return this.loadOrderGroup(subOrder.orderGroupId);
  }

  async findByIdForUser(
    orderGroupOrOrderId: string,
    requestUser: { sub: string; roles: string[] }
  ): Promise<OrderGroup> {
    const orderGroup = await this.findById(orderGroupOrOrderId);

    if (requestUser.roles.includes("ADMIN")) {
      return orderGroup;
    }

    if (orderGroup.customerId === requestUser.sub || orderGroup.courierId === requestUser.sub) {
      return orderGroup;
    }

    if (requestUser.roles.includes("BUSINESS_OWNER")) {
      for (const businessOrder of orderGroup.businessOrders) {
        const business = await this.businessesService.findById(businessOrder.businessId);

        if (business.ownerUserId === requestUser.sub) {
          return orderGroup;
        }
      }
    }

    throw new ForbiddenException("User cannot access this order");
  }

  async findByCustomer(customerId: string): Promise<OrderGroup[]> {
    const orders = await this.orderRepository.find({
      where: { userId: customerId },
      order: { createdAt: "DESC" }
    });

    const orderGroupIds = [...new Set(orders.map((order) => order.orderGroupId).filter(Boolean))];
    return Promise.all(orderGroupIds.map((orderGroupId) => this.loadOrderGroup(orderGroupId)));
  }

  async findReadyForCourier(courierId: string): Promise<OrderGroup[]> {
    if (await this.isCourierBlockedFromNewOrders(courierId)) {
      return [];
    }

    const orders = await this.orderRepository.find({
      relations: ["items"],
      order: { createdAt: "DESC" }
    });
    const groups = this.groupOrders(orders);
    const readyGroups: Order[][] = [];

    for (const groupOrders of groups) {
      if (
        this.hasCollectableOrders(groupOrders) &&
        await this.hasCashCapacityForOrders(courierId, groupOrders)
      ) {
        readyGroups.push(groupOrders);
      }
    }

    return Promise.all(
      readyGroups.map(async (groupOrders) => {
        const orderGroup = this.mapCourierOrderGroup(groupOrders);
        const customer = await this.userRepository.findOne({
          where: { id: orderGroup.customerId }
        });

        return {
          ...orderGroup,
          customerName: customer?.fullName,
          customerPhone: customer?.phone
        };
      })
    );
  }

  async findAssignedToCourier(courierId: string): Promise<OrderGroup[]> {
    const orders = await this.orderRepository.find({
      where: { courierId },
      relations: ["items"],
      order: { createdAt: "DESC" }
    });

    return Promise.all(
      this.groupOrders(orders).map((groupOrders) =>
        this.attachCustomerDetails(this.mapCourierOrderGroup(groupOrders))
      )
    );
  }

  async findPendingForBusiness(ownerUserId: string, businessId: string): Promise<BusinessOrder[]> {
    await this.assertBusinessOwner(ownerUserId, businessId);

    const orders = await this.orderRepository.find({
      where: { businessId },
      relations: ["items"],
      order: { createdAt: "DESC" }
    });

    return orders.map((order) => this.mapBusinessOrder(order));
  }

  async updateBusinessOrderStatus(
    ownerUserId: string,
    businessId: string,
    businessOrderId: string,
    nextStatus: Exclude<BusinessOrderStatus, "PENDING">
  ): Promise<BusinessOrder> {
    await this.assertBusinessOwner(ownerUserId, businessId);

    const order = await this.orderRepository.findOne({
      where: { id: businessOrderId, businessId },
      relations: ["items"]
    });

    if (!order) {
      throw new NotFoundException("Business order not found for business");
    }

    if (nextStatus !== "REJECTED" && !this.canBusinessProcessOrder(order)) {
      throw new ConflictException("Order must be paid before business processing");
    }

    if (nextStatus === "DELIVERED" && order.fulfillmentMethod !== "PICKUP") {
      throw new ConflictException("Only pickup orders can be marked delivered by the business");
    }

    if (nextStatus === "DELIVERED" && order.fulfillmentMethod === "PICKUP" && order.paymentMethod === "CASH") {
      throw new ConflictException("Confirm cash received to complete this pickup order");
    }

    this.assertValidTransition(order.status as BusinessOrderStatus, nextStatus);
    order.status = nextStatus === "ACCEPTED" ? "PREPARING" : nextStatus;
    const savedOrder = await this.orderRepository.save(order);
    savedOrder.items = order.items;

    if (nextStatus === "ACCEPTED") {
      await this.orderProcessingQueue.addBusinessReadyTimeout(order.orderGroupId, order.id);
    }

    if (order.status === "READY" && order.courierId) {
      await this.notificationsService.sendToUser(order.courierId, {
        title: "Orden lista para recoger",
        body: "Una orden de tu multipedido ya esta lista en el comercio.",
        data: { type: "BUSINESS_ORDER_READY", orderGroupId: order.orderGroupId, businessOrderId: order.id }
      });
    } else if (order.status === "READY" && order.fulfillmentMethod === "DELIVERY") {
      await this.enqueueDeliveryOfferGeneration(order.orderGroupId);
    }
    this.monitoring?.recordOrderEvent("business_status_updated", {
      orderGroupId: order.orderGroupId,
      businessOrderId: order.id,
      businessId,
      status: order.status
    });

    if (nextStatus === "REJECTED") {
      await this.handleBusinessOrderRejected(savedOrder);
    } else {
      await this.notifyCustomerOrderStatus(order.orderGroupId, order.status as BusinessOrderStatus);
    }

    return this.mapBusinessOrder(savedOrder);
  }

  async confirmBusinessCashPayout(
    ownerUserId: string,
    businessId: string,
    businessOrderId: string
  ): Promise<BusinessOrder> {
    await this.assertBusinessOwner(ownerUserId, businessId);

    const order = await this.orderRepository.findOne({
      where: { id: businessOrderId, businessId },
      relations: ["items"] as never
    });

    if (!order) {
      throw new NotFoundException("Business order not found for business");
    }

    if (order.paymentMethod !== "CASH") {
      throw new ConflictException("This business order was not paid in cash");
    }

    if (Number(order.businessPayoutCents ?? 0) <= 0) {
      throw new ConflictException("This business order has no business payout");
    }

    if (order.fulfillmentMethod === "PICKUP") {
      if (!["READY", "DELIVERED"].includes(order.status as string)) {
        throw new ConflictException("Cash payment can be confirmed when the pickup order is ready");
      }

      order.paymentStatus = "PAID";
      order.paidAt = order.paidAt ?? new Date();
      order.cashCollectedAt = order.cashCollectedAt ?? order.paidAt;
      order.cashReceivedCents = order.cashReceivedCents ?? order.subtotalCents;
      order.cashChangeCents = order.cashChangeCents ?? 0;
      order.status = "DELIVERED";
    } else if (order.status !== "DELIVERED" || order.paymentStatus !== "PAID") {
      throw new ConflictException("Cash payout can be confirmed after the order is delivered and paid");
    }

    if (order.businessCashPayoutStatus === "CONFIRMED") {
      return this.mapBusinessOrder(order);
    }

    if (order.businessCashPayoutStatus === "CANCELLED") {
      throw new ConflictException("This business cash payout was cancelled");
    }

    order.businessCashPayoutStatus = "CONFIRMED";
    order.businessCashPayoutConfirmedAt = new Date();
    order.businessCashPayoutConfirmedByUserId = ownerUserId;

    const savedOrder = await this.orderRepository.save(order);
    return this.mapBusinessOrder(savedOrder as Order);
  }

  async updateCourierAvailability(
    courierId: string,
    dto: UpdateCourierAvailabilityDto
  ): Promise<CourierProfile> {
    if (dto.status === "AVAILABLE") {
      await this.assertCourierCanReceiveNewOrders(courierId);
    }

    if (dto.latitude !== undefined || dto.longitude !== undefined) {
      if (dto.latitude === undefined || dto.longitude === undefined) {
        throw new BadRequestException("Both latitude and longitude are required");
      }

      assertInsideVegaServiceaddress({
        latitude: dto.latitude,
        longitude: dto.longitude
      });
    }

    const profile = await this.ensureCourierProfile(courierId);
    profile.availabilityStatus = dto.status;

    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      profile.preferredLatitude = dto.latitude;
      profile.preferredLongitude = dto.longitude;
    }

    profile.preferredRadiusKm = dto.preferredRadiusKm ?? profile.preferredRadiusKm ?? 35;
    profile.maxDeliveryDistanceKm = dto.maxDeliveryDistanceKm ?? profile.maxDeliveryDistanceKm ?? 35;

    const savedProfile = await this.courierProfileRepository.save(profile);

    if (savedProfile.availabilityStatus === "AVAILABLE") {
      await this.enqueueReadyDeliveryOfferGenerations();
    }

    return savedProfile;
  }

  async getCourierStripeConnectProfile(courierId: string): Promise<CourierProfile> {
    return this.ensureCourierProfile(courierId);
  }

  async createCourierStripeConnectAccount(courierId: string): Promise<CourierProfile> {
    let profile = await this.ensureCourierProfile(courierId);

    if (profile.stripeConnectedAccountId) {
      profile = await this.refreshCourierStripeConnectStatusForProfile(profile);
      if (profile.stripeConnectedAccountId) {
        return profile;
      }
    }

    const user = await this.userRepository.findOne({ where: { id: courierId } });

    if (!user) {
      throw new NotFoundException("Courier not found");
    }

    const account = await this.stripeConnectService.createExpressAccount({
      email: user.email,
      profileName: user.fullName,
      requestTransfers: true,
      requestCardPayments: false,
      fallbackPlatformAccountId: profile.stripePlatformAccountId,
      metadata: {
        courier_user_id: courierId
      }
    });

    profile.stripeConnectedAccountId = account.accountId;
    profile.stripePlatformAccountId = account.platformAccountId;
    profile.stripeChargesEnabled = false;
    profile.stripePayoutsEnabled = false;
    profile.stripeDetailsSubmitted = false;
    profile.stripeRequirementsCurrentlyDue = null;

    return this.courierProfileRepository.save(profile);
  }

  async createCourierStripeOnboardingLink(courierId: string): Promise<{ url: string; profile: CourierProfile }> {
    let profile = await this.ensureCourierProfile(courierId);

    if (profile.stripeConnectedAccountId) {
      profile = await this.refreshCourierStripeConnectStatusForProfile(profile);
    }

    if (!profile.stripeConnectedAccountId) {
      profile = await this.createCourierStripeConnectAccount(courierId);
    }

    const normalizedAppBaseUrl = this.stripeConnectService.requireReturnBaseUrl({
      primaryEnvKey: "COURIER_APP_URL",
      fallbackEnvKey: "PUBLIC_API_URL",
      label: "COURIER_APP_URL or PUBLIC_API_URL"
    });
    const url = await this.stripeConnectService.createOnboardingLink({
      connectedAccountId: profile.stripeConnectedAccountId ?? "",
      refreshUrl: `${normalizedAppBaseUrl}/courier-stripe-refresh?courierId=${profile.userId}`,
      returnUrl: `${normalizedAppBaseUrl}/courier-stripe-return?courierId=${profile.userId}`
    });

    return { url, profile };
  }

  async refreshCourierStripeConnectStatus(courierId: string): Promise<CourierProfile> {
    const profile = await this.ensureCourierProfile(courierId);
    const refreshedProfile = await this.refreshCourierStripeConnectStatusForProfile(profile);

    if (refreshedProfile.stripePayoutsEnabled) {
      await this.enqueueRecoverableCourierPayouts(courierId);
    }

    return refreshedProfile;
  }

  async refreshCourierStripeConnectStatusFromReturn(courierId: string): Promise<CourierProfile> {
    const profile = await this.ensureCourierProfile(courierId);
    return this.refreshCourierStripeConnectStatusForProfile(profile);
  }

  async findOffersForCourier(courierId: string): Promise<DeliveryOfferSummary[]> {
    if (await this.isCourierBlockedFromNewOrders(courierId)) {
      return [];
    }

    await this.expireStaleOffers();
    await this.ensureDeliveryOffersForAvailableCourier(courierId);

    const offers = await this.deliveryOfferRepository.find({
      where: { courierId, status: "PENDING" },
      order: { score: "DESC", createdAt: "ASC" }
    });

    const activeOffers = offers.filter((offer) => offer.expiresAt.getTime() > Date.now());
    const summaries: DeliveryOfferSummary[] = [];

    for (const offer of activeOffers) {
      try {
        const orders = await this.orderRepository.find({
          where: { orderGroupId: offer.orderGroupId },
          relations: ["items"],
          order: { createdAt: "ASC" }
        });

        if (!orders.length) {
          continue;
        }

        const courierOrder = await this.attachCustomerDetails(this.mapCourierOrderGroup(orders));

        if (
          this.hasCollectableOrders(orders) &&
          await this.hasCashCapacityForOrders(courierId, orders)
        ) {
          summaries.push({
            id: offer.id,
            status: offer.status,
            score: offer.score,
            expiresAt: offer.expiresAt,
            order: courierOrder
          });
        }
      } catch (error) {
        if (!(error instanceof NotFoundException)) {
          throw error;
        }
      }
    }

    return summaries;
  }

  async findReadyOrderGroupIdsNeedingDeliveryOffers(): Promise<string[]> {
    await this.expireStaleOffers();

    const readyOrders = await this.orderRepository.find({
      where: { status: "READY" }
    });
    const orderGroupIds = [...new Set(readyOrders.map((order) => order.orderGroupId).filter(Boolean))];
    const recoverableOrderGroupIds: string[] = [];

    for (const orderGroupId of orderGroupIds) {
      const orders = await this.orderRepository.find({
        where: { orderGroupId }
      });

      if (!orders.length || orders.some((order) => order.courierId)) {
        continue;
      }

      if (!this.hasCollectableOrders(orders)) {
        continue;
      }

      const existingOffer = await this.deliveryOfferRepository.findOne({
        where: { orderGroupId, status: "PENDING" }
      });

      if (!existingOffer) {
        recoverableOrderGroupIds.push(orderGroupId);
      }
    }

    return recoverableOrderGroupIds;
  }

  async generateDeliveryOffersForGroup(orderGroupId: string): Promise<void> {
    await this.ensureDeliveryOffersForGroup(orderGroupId);
  }

  async scheduleBusinessAcceptanceTimeouts(orderGroupId: string): Promise<void> {
    const orders = await this.orderRepository.find({
      where: { orderGroupId, status: "PENDING" }
    });

    const paidPendingOrders = orders.filter((order) => this.canBusinessProcessOrder(order));

    for (const order of paidPendingOrders) {
      await this.orderProcessingQueue.addBusinessAcceptanceTimeout(order.orderGroupId, order.id);
    }

    if (paidPendingOrders.length) {
      this.monitoring?.recordOrderEvent("business_acceptance_timeout_scheduled", {
        orderGroupId,
        businessOrderCount: paidPendingOrders.length
      });

      await this.notifyBusinessesProcessableOrders(paidPendingOrders);
    }
  }

  async scheduleRecoverableLifecycleTimeouts(): Promise<void> {
    const paidActiveOrders = await this.orderRepository.find({
      where: [
        { paymentStatus: "PAID" },
        { paymentMethod: "CASH" }
      ]
    });

    for (const order of paidActiveOrders) {
      if (order.status === "PENDING") {
        await this.orderProcessingQueue.addBusinessAcceptanceTimeout(order.orderGroupId, order.id);
      }

      if (order.status === "PREPARING" || order.status === "ACCEPTED") {
        await this.orderProcessingQueue.addBusinessReadyTimeout(order.orderGroupId, order.id);
      }
    }

    const readyOrderGroupIds = await this.findReadyOrderGroupIdsWithoutCourier();
    for (const orderGroupId of readyOrderGroupIds) {
      await this.orderProcessingQueue.addDeliveryOfferTimeout(orderGroupId);
    }

    await this.scheduleRecoverableCourierDeliveryTimeouts(paidActiveOrders);
  }

  async handleLifecycleJob(job: OrderLifecycleJob): Promise<void> {
    if (job.type === "BUSINESS_ACCEPTANCE_TIMEOUT") {
      await this.handleBusinessAcceptanceTimeout(job.orderGroupId, job.businessOrderId);
      return;
    }

    if (job.type === "BUSINESS_READY_TIMEOUT") {
      await this.handleBusinessReadyTimeout(job.orderGroupId, job.businessOrderId);
      return;
    }

    if (job.type === "COURIER_DELIVERY_TIMEOUT") {
      await this.handleCourierDeliveryTimeout(job.orderGroupId);
      return;
    }

    await this.handleDeliveryOfferTimeout(job.orderGroupId);
  }

  async acceptDeliveryOffer(courierId: string, offerId: string): Promise<OrderGroup> {
    await this.assertCourierCanReceiveNewOrders(courierId);

    return this.dataSource.transaction(async (manager) => {
      const offer = await manager.findOne(DeliveryOffer, {
        where: { id: offerId },
        lock: { mode: "pessimistic_write" }
      });

      if (!offer) {
        throw new NotFoundException("Delivery offer not found");
      }

      if (offer.courierId !== courierId) {
        throw new ForbiddenException("Offer is not assigned to this courier");
      }

      if (offer.status !== "PENDING") {
        throw new ConflictException("Delivery offer is no longer available");
      }

      if (offer.expiresAt.getTime() <= Date.now()) {
        offer.status = "EXPIRED";
        await manager.save(DeliveryOffer, offer);
        throw new ConflictException("Delivery offer expired");
      }

      const orders = await manager.find(Order, {
        where: { orderGroupId: offer.orderGroupId },
        lock: { mode: "pessimistic_write" }
      });

      if (!orders.length) {
        throw new NotFoundException("Order not found");
      }

      if (!this.hasCollectableOrders(orders)) {
        offer.status = "CANCELLED";
        await manager.save(DeliveryOffer, offer);
        throw new ConflictException("Order is no longer ready for pickup");
      }

      await this.courierWalletService.assertCanCoverCashOrders(courierId, orders, manager);

      if (orders.some((order) => order.courierId && order.courierId !== courierId)) {
        offer.status = "CANCELLED";
        await manager.save(DeliveryOffer, offer);
        throw new ConflictException("Order is already assigned to another courier");
      }

      for (const order of orders) {
        order.courierId = courierId;
        if (order.status === "READY") {
          order.status = "ASSIGNED";
        }
        order.items = await manager.find(OrderItem, {
          where: { orderId: order.id }
        });
      }

      offer.status = "ACCEPTED";
      offer.acceptedAt = new Date();

      const competingOffers = await manager.find(DeliveryOffer, {
        where: { orderGroupId: offer.orderGroupId, status: "PENDING" }
      });

      const cancelledOffers = competingOffers.filter(
        (competingOffer) => competingOffer.id !== offer.id
      );

      for (const competingOffer of cancelledOffers) {
        competingOffer.status = "CANCELLED";
      }

      const profile = await manager.findOne(CourierProfile, {
        where: { userId: courierId }
      });

      if (profile) {
        profile.availabilityStatus = "BUSY";
        await manager.save(CourierProfile, profile);
      }

      await manager.save(Order, orders);
      await manager.save(DeliveryOffer, [offer, ...cancelledOffers]);
      await this.orderProcessingQueue.addCourierDeliveryTimeout(offer.orderGroupId);
      this.monitoring?.recordOrderEvent("offer_accepted", {
        orderGroupId: offer.orderGroupId,
        offerId: offer.id,
        courierId,
        cancelledOffers: cancelledOffers.length
      });

      await this.notificationsService.sendToUser(orders[0].userId, {
        title: "Tu pedido ya tiene repartidor",
        body: "Un repartidor acepto tu entrega y va por tu pedido.",
        data: { type: "ORDER_ASSIGNED", orderGroupId: offer.orderGroupId }
      });

      return this.attachCustomerDetails(this.mapCourierOrderGroup(orders));
    });
  }

  async assignToCourier(courierId: string, orderGroupId: string): Promise<OrderGroup> {
    await this.assertCourierCanReceiveNewOrders(courierId);

    return this.dataSource.transaction(async (manager) => {
      const orders = await manager.find(Order, {
        where: { orderGroupId },
        lock: { mode: "pessimistic_write" }
      });

      if (!orders.length) {
        throw new NotFoundException("Order not found");
      }

      if (!this.hasCollectableOrders(orders)) {
        throw new ConflictException("Order is not ready for pickup");
      }

      await this.courierWalletService.assertCanCoverCashOrders(courierId, orders, manager);

      if (orders.some((order) => order.courierId && order.courierId !== courierId)) {
        throw new ConflictException("Order is already assigned to another courier");
      }

      for (const order of orders) {
        order.courierId = courierId;
        if (order.status === "READY") {
          order.status = "ASSIGNED";
        }

        order.items = await manager.find(OrderItem, {
          where: { orderId: order.id }
        });
      }

      await manager.save(Order, orders);
      await this.orderProcessingQueue.addCourierDeliveryTimeout(orderGroupId);

      return this.attachCustomerDetails(this.mapCourierOrderGroup(orders));
    });
  }

  async updateCourierDeliveryStatus(
    courierId: string,
    orderGroupId: string,
    nextStatus: "PICKED_UP" | "ON_THE_WAY" | "DELIVERED",
    cashReceivedCents?: number
  ): Promise<OrderGroup> {
    let shouldEnqueueCourierPayout = false;
    let customerStatusNotification: CustomerStatusNotification | null = null;

    const updatedOrderGroup = await this.dataSource.transaction(async (manager) => {
      const orders = await manager.find(Order, {
        where: { orderGroupId },
        lock: { mode: "pessimistic_write" }
      });

      if (!orders.length) {
        throw new NotFoundException("Order not found");
      }

      if (orders.some((order) => order.courierId !== courierId)) {
        throw new ForbiddenException("Order is not assigned to this courier");
      }

      this.assertValidCourierTransition(
        orders.map((order) => order.status as BusinessOrderStatus),
        nextStatus
      );

      if (nextStatus === "DELIVERED") {
        this.assertCashCollectionForDelivery(orders, cashReceivedCents);
      }

      const groupTotalCents = this.totalCentsForOrders(orders);
      const cashCollectedAt = nextStatus === "DELIVERED" && orders[0].paymentMethod === "CASH"
        ? new Date()
        : null;

      for (const order of orders) {
        if (nextStatus === "PICKED_UP") {
          if (["ASSIGNED", "READY"].includes(order.status as string)) {
            order.status = "PICKED_UP";
          }
        } else {
          order.status = nextStatus;
        }

        if (cashCollectedAt) {
          order.cashReceivedCents = cashReceivedCents;
          order.cashChangeCents = cashReceivedCents === undefined ? null : cashReceivedCents - groupTotalCents;
          order.cashCollectedAt = cashCollectedAt;
          order.paymentStatus = "PAID";
          order.paidAt = cashCollectedAt;
          order.businessCashPayoutStatus = "NOT_APPLICABLE";
          if (
            order.courierPayoutStatus === "PENDING" &&
            Number(order.courierPayoutCents ?? 0) > 0
          ) {
            order.courierPayoutStatus = "PAID";
            order.courierPayoutPaidAt = cashCollectedAt;
            order.courierPayoutFailedAt = null;
            order.courierPayoutError = null;
          }
        }

        if (
          nextStatus === "DELIVERED" &&
          order.paymentMethod === "CARD" &&
          order.paymentStatus === "PAID" &&
          order.courierPayoutStatus === "PENDING" &&
          Number(order.courierPayoutCents ?? 0) > 0
        ) {
          shouldEnqueueCourierPayout = true;
        }

        order.items = await manager.find(OrderItem, {
          where: { orderId: order.id }
        });
      }

      await manager.save(Order, orders);

      if (cashCollectedAt) {
        const walletTransaction = await this.courierWalletService.debitCashOrderSettlement(
          courierId,
          orders,
          manager,
          { cashReceivedCents }
        );
        this.monitoring?.recordPaymentEvent("courier_wallet_cash_order_settled", {
          orderGroupId,
          courierId,
          amountCents: walletTransaction ? Math.abs(walletTransaction.amountCents) : 0
        });
      }

      this.monitoring?.recordOrderEvent("courier_status_updated", {
        orderGroupId,
        courierId,
        status: nextStatus
      });

      if (nextStatus === "DELIVERED") {
        const remainingActiveOrders = await manager.find(Order, {
          where: { courierId }
        });
        const hasActiveDelivery = this.groupOrders(remainingActiveOrders).some((groupOrders) =>
          ["ASSIGNED", "PICKED_UP", "ON_THE_WAY"].includes(
            this.deriveOrderGroupStatus(
              groupOrders.map((order) => order.status as BusinessOrderStatus)
            )
          )
        );

        if (!hasActiveDelivery) {
          const profile = await manager.findOne(CourierProfile, {
            where: { userId: courierId }
          });

          if (profile) {
            profile.availabilityStatus = "AVAILABLE";
            await manager.save(CourierProfile, profile);
          }
        }
      }

      customerStatusNotification = {
        userId: orders[0].userId,
        title: this.notificationTitleForCourierStatus(nextStatus),
        body: this.notificationBodyForCourierStatus(nextStatus),
        data: { type: "ORDER_STATUS", orderGroupId, status: nextStatus }
      };

      return this.attachCustomerDetails(this.mapCourierOrderGroup(orders));
    });

    const notificationToSend = customerStatusNotification as CustomerStatusNotification | null;

    if (notificationToSend) {
      try {
        await this.notificationsService.sendToUser(notificationToSend.userId, {
          title: notificationToSend.title,
          body: notificationToSend.body,
          data: notificationToSend.data
        });
      } catch (error) {
        this.monitoring?.recordNotificationEvent("order_status_failed", {
          orderGroupId,
          status: nextStatus,
          error: error instanceof Error ? error.message : "unknown"
        });
      }
    }

    if (shouldEnqueueCourierPayout) {
      try {
        await this.paymentProcessingQueue.addCourierPayout(orderGroupId);
      } catch (error) {
        this.monitoring?.recordPaymentEvent("courier_payout_enqueue_failed", {
          orderGroupId,
          courierId,
          error: error instanceof Error ? error.message : "unknown"
        });
      }
    }

    return updatedOrderGroup;
  }

  async markBusinessOrderPickedUp(
    courierId: string,
    orderGroupId: string,
    businessOrderId: string
  ): Promise<OrderGroup> {
    return this.dataSource.transaction(async (manager) => {
      const orders = await manager.find(Order, {
        where: { orderGroupId },
        lock: { mode: "pessimistic_write" }
      });

      if (!orders.length) {
        throw new NotFoundException("Order not found");
      }

      if (orders.some((order) => order.courierId !== courierId)) {
        throw new ForbiddenException("Order is not assigned to this courier");
      }

      const order = orders.find((current) => current.id === businessOrderId);

      if (!order) {
        throw new NotFoundException("Business order not found");
      }

      if (!["ASSIGNED", "READY"].includes(order.status as string)) {
        throw new ConflictException("Business order is not ready for pickup");
      }

      order.status = "PICKED_UP";

      for (const current of orders) {
        current.items = await manager.find(OrderItem, {
          where: { orderId: current.id }
        });
      }

      await manager.save(Order, order);
      this.monitoring?.recordOrderEvent("business_order_picked_up", {
        orderGroupId,
        businessOrderId,
        courierId
      });

      return this.attachCustomerDetails(this.mapCourierOrderGroup(orders));
    });
  }

  async updateCustomerLocation(
    customerId: string,
    orderGroupId: string,
    location: LocationDto
  ): Promise<{ ok: true }> {
    assertInsideVegaServiceaddress(location);

    const orders = await this.orderRepository.find({ where: { orderGroupId } });

    if (!orders.length) {
      throw new NotFoundException("Order not found");
    }

    if (orders.some((order) => order.userId !== customerId)) {
      throw new ForbiddenException("Only the customer can update this location");
    }

    if (!this.isDeliveryLocationVisible(orders.map((order) => order.status as BusinessOrderStatus))) {
      throw new ConflictException("Location can only be shared while delivery is active");
    }

    for (const order of orders) {
      order.customerLatitude = location.latitude;
      order.customerLongitude = location.longitude;
    }

    await this.orderRepository.save(orders);
    await this.notifyCustomerIfCourierArrived(orders);
    return { ok: true };
  }

  async updateCourierLocation(
    courierId: string,
    orderGroupId: string,
    location: LocationDto
  ): Promise<{ ok: true }> {
    assertInsideVegaServiceaddress(location);

    const orders = await this.orderRepository.find({ where: { orderGroupId } });

    if (!orders.length) {
      throw new NotFoundException("Order not found");
    }

    if (orders.some((order) => order.courierId !== courierId)) {
      throw new ForbiddenException("Only the assigned courier can update this location");
    }

    if (!this.isDeliveryLocationVisible(orders.map((order) => order.status as BusinessOrderStatus))) {
      throw new ConflictException("Location can only be shared while delivery is active");
    }

    for (const order of orders) {
      order.courierLatitude = location.latitude;
      order.courierLongitude = location.longitude;
    }

    await this.orderRepository.save(orders);
    await this.notifyCustomerIfCourierArrived(orders);
    return { ok: true };
  }

  async notifyCustomerCourierArrived(
    courierId: string,
    orderGroupId: string
  ): Promise<{ ok: true; alreadyNotified: boolean }> {
    const orders = await this.orderRepository.find({ where: { orderGroupId } });
    const [firstOrder] = orders;

    if (!firstOrder) {
      throw new NotFoundException("Order not found");
    }

    if (orders.some((order) => order.courierId !== courierId)) {
      throw new ForbiddenException("Only the assigned courier can notify arrival");
    }

    const groupStatus = this.deriveOrderGroupStatus(
      orders.map((order) => order.status as BusinessOrderStatus)
    );

    if (groupStatus !== "ON_THE_WAY") {
      throw new ConflictException("Arrival can only be notified while the order is on the way");
    }

    if (firstOrder.arrivalNotifiedAt) {
      return { ok: true, alreadyNotified: true };
    }

    for (const order of orders) {
      order.arrivalNotifiedAt = new Date();
    }

    await this.orderRepository.save(orders);
    await this.sendCourierArrivedNotification(firstOrder);
    return { ok: true, alreadyNotified: false };
  }

  async getDeliveryLocation(requestUserId: string, orderGroupId: string) {
    const orders = await this.orderRepository.find({ where: { orderGroupId } });

    if (!orders.length) {
      throw new NotFoundException("Order not found");
    }

    const [firstOrder] = orders;
    const isCustomer = firstOrder.userId === requestUserId;
    const isAssignedCourier = firstOrder.courierId === requestUserId;

    if (!isCustomer && !isAssignedCourier) {
      throw new ForbiddenException("Location is private for this delivery");
    }

    if (!this.isDeliveryLocationVisible(orders.map((order) => order.status as BusinessOrderStatus))) {
      throw new ConflictException("Location is only available while delivery is active");
    }

    return {
      orderGroupId,
      customer:
        firstOrder.customerLatitude !== null &&
          firstOrder.customerLatitude !== undefined &&
          firstOrder.customerLongitude !== null &&
          firstOrder.customerLongitude !== undefined
          ? {
            latitude: Number(firstOrder.customerLatitude),
            longitude: Number(firstOrder.customerLongitude)
          }
          : null,
      courier:
        firstOrder.courierLatitude !== null &&
          firstOrder.courierLatitude !== undefined &&
          firstOrder.courierLongitude !== null &&
          firstOrder.courierLongitude !== undefined
          ? {
            latitude: Number(firstOrder.courierLatitude),
            longitude: Number(firstOrder.courierLongitude)
          }
          : null
    };
  }

  private async loadOrderGroup(
    orderGroupId: string,
    manager?: EntityManager
  ): Promise<OrderGroup> {
    const repository = manager?.getRepository(Order) ?? this.orderRepository;
    const orders = await repository.find({
      where: { orderGroupId },
      relations: ["items"],
      order: { createdAt: "ASC" }
    });

    if (!orders.length) {
      throw new NotFoundException("Order not found");
    }

    return this.mapOrderGroup(orders);
  }

  private mapOrderGroup(orders: Order[]): OrderGroup {
    const [firstOrder] = orders;
    const businessOrders = orders.map((order) => this.mapBusinessOrder(order));
    const courierPayoutOrder = orders.find((order) => Number(order.courierPayoutCents ?? 0) > 0);

    return {
      id: firstOrder.orderGroupId,
      customerId: firstOrder.userId,
      deliveryAddress: firstOrder.deliveryAddress,
      fulfillmentMethod: firstOrder.fulfillmentMethod,
      status: this.deriveOrderGroupStatus(
        businessOrders.map((businessOrder) => businessOrder.status)
      ),
      businessOrders,
      totalCents: businessOrders.reduce(
        (sum, businessOrder) => sum + businessOrder.subtotalCents,
        0
      ) + orders.reduce((sum, order) => sum + Number(order.deliveryFeeCents ?? 0), 0),
      subtotalCents: businessOrders.reduce(
        (sum, businessOrder) => sum + businessOrder.subtotalCents,
        0
      ),
      deliveryFeeCents: orders.reduce((sum, order) => sum + Number(order.deliveryFeeCents ?? 0), 0),
      courierPayoutCents: orders.reduce((sum, order) => sum + Number(order.courierPayoutCents ?? 0), 0),
      courierPayoutStatus: courierPayoutOrder?.courierPayoutStatus,
      courierPayoutPaidAt: courierPayoutOrder?.courierPayoutPaidAt,
      courierPayoutProviderTransferId: courierPayoutOrder?.courierPayoutProviderTransferId,
      courierPayoutFailedAt: courierPayoutOrder?.courierPayoutFailedAt,
      courierPayoutError: courierPayoutOrder?.courierPayoutError,
      platformDeliveryMarginCents: orders.reduce((sum, order) => sum + Number(order.platformDeliveryMarginCents ?? 0), 0),
      cashSettlementRequiredCents: this.courierWalletService.cashSettlementRequiredCents(orders),
      createdAt: firstOrder.createdAt,
      courierId: firstOrder.courierId,
      paymentMethod: firstOrder.paymentMethod,
      paymentStatus: firstOrder.paymentStatus,
      cashReceivedCents: firstOrder.cashReceivedCents,
      cashChangeCents: firstOrder.cashChangeCents,
      cashCollectedAt: firstOrder.cashCollectedAt,
      paidAt: firstOrder.paidAt
    };
  }

  private mapCourierOrderGroup(orders: Order[]): OrderGroup {
    const orderGroup = this.mapOrderGroup(orders);

    return {
      ...orderGroup,
      items: orderGroup.businessOrders.flatMap((businessOrder) => businessOrder.items)
    };
  }

  private async attachCustomerDetails(orderGroup: OrderGroup): Promise<OrderGroup> {
    const customer = await this.userRepository.findOne({
      where: { id: orderGroup.customerId }
    });

    return {
      ...orderGroup,
      customerName: customer?.fullName,
      customerPhone: customer?.phone
    };
  }

  private async scheduleRecoverableCourierDeliveryTimeouts(orders: Order[]): Promise<void> {
    const activeOrderGroupIds = [...new Set(
      orders
        .filter((order) => order.courierId && this.activeCourierDeliveryStatuses.has(order.status as string))
        .map((order) => order.orderGroupId)
        .filter(Boolean)
    )];

    for (const orderGroupId of activeOrderGroupIds) {
      const acceptedOffer = await this.deliveryOfferRepository.findOne({
        where: { orderGroupId, status: "ACCEPTED" },
        order: { acceptedAt: "DESC" }
      });
      const groupOrders = orders.filter((order) => order.orderGroupId === orderGroupId);
      const assignedAt = acceptedOffer?.acceptedAt ?? groupOrders
        .map((order) => order.updatedAt)
        .filter(Boolean)
        .sort((left, right) => left.getTime() - right.getTime())[0];

      await this.orderProcessingQueue.addCourierDeliveryTimeout(
        orderGroupId,
        this.remainingCourierDeliveryTimeoutMs(assignedAt)
      );
    }
  }

  private remainingCourierDeliveryTimeoutMs(startedAt?: Date | null): number {
    if (!startedAt) {
      return this.courierDeliveryTimeoutMs();
    }

    return Math.max(0, startedAt.getTime() + this.courierDeliveryTimeoutMs() - Date.now());
  }

  private courierDeliveryTimeoutMs(): number {
    const configuredMinutes = Number(process.env.COURIER_DELIVERY_TIMEOUT_MINUTES ?? 40);
    const safeMinutes = Number.isFinite(configuredMinutes) && configuredMinutes > 0 ? configuredMinutes : 40;
    return safeMinutes * 60_000;
  }

  private async handleCourierDeliveryTimeout(orderGroupId: string): Promise<void> {
    const orders = await this.orderRepository.find({
      where: { orderGroupId }
    });

    if (
      !orders.length ||
      !orders.some((order) => order.courierId) ||
      !orders.some((order) => this.activeCourierDeliveryStatuses.has(order.status as string))
    ) {
      return;
    }

    const courierIds = [...new Set(
      orders
        .map((order) => order.courierId)
        .filter((courierId): courierId is string => Boolean(courierId))
    )];

    await this.cancelOrderGroupAndRefund(
      orderGroupId,
      "COURIER_DELIVERY_TIMEOUT",
      "El repartidor no completo la entrega a tiempo. Cancelamos el pedido y procesamos el reembolso si el pago ya fue confirmado."
    );

    for (const courierId of courierIds) {
      await this.markCourierAvailableIfNoActiveDeliveries(courierId);
    }
  }

  private async markCourierAvailableIfNoActiveDeliveries(courierId: string): Promise<void> {
    const assignedOrders = await this.orderRepository.find({
      where: { courierId }
    });
    const hasActiveDelivery = this.groupOrders(assignedOrders).some((groupOrders) =>
      this.activeCourierDeliveryStatuses.has(
        this.deriveOrderGroupStatus(
          groupOrders.map((order) => order.status as BusinessOrderStatus)
        )
      )
    );

    if (hasActiveDelivery) {
      return;
    }

    const profile = await this.courierProfileRepository.findOne({
      where: { userId: courierId }
    });

    if (profile) {
      profile.availabilityStatus = "AVAILABLE";
      await this.courierProfileRepository.save(profile);
    }
  }

  private async handleBusinessAcceptanceTimeout(
    orderGroupId: string,
    businessOrderId: string
  ): Promise<void> {
    const order = await this.orderRepository.findOne({
      where: { id: businessOrderId, orderGroupId }
    });

    if (!order || order.status !== "PENDING" || !this.canBusinessProcessOrder(order)) {
      return;
    }

    await this.cancelOrderGroupAndRefund(
      orderGroupId,
      "BUSINESS_ACCEPTANCE_TIMEOUT",
      "El negocio no acepto el pedido a tiempo."
    );
  }

  private async handleBusinessReadyTimeout(
    orderGroupId: string,
    businessOrderId: string
  ): Promise<void> {
    const order = await this.orderRepository.findOne({
      where: { id: businessOrderId, orderGroupId }
    });

    if (
      !order ||
      !this.canBusinessProcessOrder(order) ||
      !["ACCEPTED", "PREPARING"].includes(order.status as string)
    ) {
      return;
    }

    await this.cancelOrderGroupAndRefund(
      orderGroupId,
      "BUSINESS_READY_TIMEOUT",
      "El negocio no marco el pedido como listo a tiempo."
    );
  }

  private async handleBusinessOrderRejected(rejectedOrder: Order): Promise<void> {
    const orders = await this.orderRepository.find({
      where: { orderGroupId: rejectedOrder.orderGroupId }
    });

    if (orders.length <= 1) {
      await this.notifyCustomerOrderStatus(rejectedOrder.orderGroupId, "REJECTED");
      return;
    }

    const rejectedBusiness = await this.businessesService.findById(rejectedOrder.businessId);
    const rejectedBusinessName = rejectedBusiness.name ?? "un negocio";

    await this.cancelOrderGroupAndRefund(
      rejectedOrder.orderGroupId,
      "BUSINESS_REJECTED",
      `${rejectedBusinessName} rechazo el pedido. Cancelamos el multipedido y procesamos el reembolso si el pago ya fue confirmado.`,
      {
        rejectedBusinessId: rejectedOrder.businessId,
        rejectedBusinessOrderId: rejectedOrder.id,
        rejectedBusinessName
      }
    );
  }

  private async handleDeliveryOfferTimeout(orderGroupId: string): Promise<void> {
    await this.expireStaleOffers();

    const orders = await this.orderRepository.find({
      where: { orderGroupId }
    });

    if (
      !orders.length ||
      orders.some((order) => order.courierId) ||
      !this.hasCollectableOrders(orders)
    ) {
      return;
    }

    const offers = await this.deliveryOfferRepository.find({
      where: { orderGroupId },
      order: { score: "DESC", createdAt: "ASC" }
    });
    const bestOffer = offers.find((offer) => ["PENDING", "EXPIRED"].includes(offer.status));

    if (!bestOffer) {
      await this.ensureDeliveryOffersForGroup(orderGroupId);
      await this.orderProcessingQueue.addDeliveryOfferTimeout(orderGroupId);
      return;
    }

    await this.autoAssignOffer(bestOffer.id);
  }

  private async autoAssignOffer(offerId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const offer = await manager.findOne(DeliveryOffer, {
        where: { id: offerId },
        lock: { mode: "pessimistic_write" }
      });

      if (!offer || !["PENDING", "EXPIRED"].includes(offer.status)) {
        return;
      }

      const orders = await manager.find(Order, {
        where: { orderGroupId: offer.orderGroupId },
        lock: { mode: "pessimistic_write" }
      });

      if (
        !orders.length ||
        orders.some((order) => order.courierId) ||
        !this.hasCollectableOrders(orders)
      ) {
        offer.status = "CANCELLED";
        await manager.save(DeliveryOffer, offer);
        return;
      }

      for (const order of orders) {
        order.courierId = offer.courierId;
        if (order.status === "READY") {
          order.status = "ASSIGNED";
        }
      }

      offer.status = "ACCEPTED";
      offer.acceptedAt = new Date();

      const competingOffers = await manager.find(DeliveryOffer, {
        where: { orderGroupId: offer.orderGroupId, status: "PENDING" }
      });
      const cancelledOffers = competingOffers.filter((competingOffer) => competingOffer.id !== offer.id);

      for (const competingOffer of cancelledOffers) {
        competingOffer.status = "CANCELLED";
      }

      const profile = await manager.findOne(CourierProfile, {
        where: { userId: offer.courierId }
      });

      if (profile) {
        profile.availabilityStatus = "BUSY";
        await manager.save(CourierProfile, profile);
      }

      await manager.save(Order, orders);
      await manager.save(DeliveryOffer, [offer, ...cancelledOffers]);
      await this.orderProcessingQueue.addCourierDeliveryTimeout(offer.orderGroupId);

      this.monitoring?.recordOrderEvent("offer_auto_assigned", {
        orderGroupId: offer.orderGroupId,
        offerId: offer.id,
        courierId: offer.courierId,
        cancelledOffers: cancelledOffers.length
      });

      await this.notificationsService.sendToUser(offer.courierId, {
        title: "Entrega asignada",
        body: "Te asignamos automaticamente un pedido listo para recoger.",
        data: { type: "ORDER_ASSIGNED", orderGroupId: offer.orderGroupId }
      });

      await this.notificationsService.sendToUser(orders[0].userId, {
        title: "Tu pedido ya tiene repartidor",
        body: "Asignamos un repartidor para recoger tu pedido.",
        data: { type: "ORDER_ASSIGNED", orderGroupId: offer.orderGroupId }
      });
    });
  }

  private async cancelOrderGroupAndRefund(
    orderGroupId: string,
    reason: string,
    customerMessage: string,
    context: {
      rejectedBusinessId?: string;
      rejectedBusinessOrderId?: string;
      rejectedBusinessName?: string;
    } = {}
  ): Promise<void> {
    const refundKey = `refund:${orderGroupId}:${reason}`;
    const payment = await this.paymentRepository.findOne({
      where: { orderGroupId, status: "SUCCEEDED" },
      order: { createdAt: "DESC" }
    });
    const transferReversals = this.providerTransfersFromMetadata(payment?.providerMetadata);

    const refund = payment
      ? await this.paymentProviderService.refundPayment(payment.providerPaymentId, refundKey, transferReversals)
      : null;

    await this.dataSource.transaction(async (manager) => {
      const orders = await manager.find(Order, {
        where: { orderGroupId },
        lock: { mode: "pessimistic_write" }
      });

      if (!orders.length || orders.every((order) => order.paymentStatus === "REFUNDED")) {
        return;
      }

      for (const order of orders) {
        if (order.id === context.rejectedBusinessOrderId) {
          order.status = "REJECTED";
          order.paymentStatus = payment ? "REFUNDED" : order.paymentStatus;
          if (order.courierPayoutStatus === "PENDING") {
            order.courierPayoutStatus = "CANCELLED";
          }
          if (order.businessCashPayoutStatus === "PENDING") {
            order.businessCashPayoutStatus = "CANCELLED";
          }
          continue;
        }

        if (order.status !== "DELIVERED") {
          order.status = "CANCELLED";
          if (order.courierPayoutStatus === "PENDING") {
            order.courierPayoutStatus = "CANCELLED";
          }
          if (order.businessCashPayoutStatus === "PENDING") {
            order.businessCashPayoutStatus = "CANCELLED";
          }
        }
        order.paymentStatus = payment ? "REFUNDED" : order.paymentStatus;
      }

      const offers = await manager.find(DeliveryOffer, {
        where: { orderGroupId, status: "PENDING" }
      });

      for (const offer of offers) {
        offer.status = "CANCELLED";
      }

      if (payment) {
        payment.status = "CANCELLED";
        payment.providerMetadata = {
          ...(payment.providerMetadata ?? {}),
          refundReason: reason,
          refundKey,
          refundProviderId: refund?.providerRefundId,
          refundStatus: refund?.status,
          transferReversals,
          refundRaw: refund?.raw
        };
        await manager.save(Payment, payment);
      }

      await manager.save(Order, orders);
      if (offers.length) {
        await manager.save(DeliveryOffer, offers);
      }

      this.monitoring?.recordOrderEvent("order_group_refunded", {
        orderGroupId,
        reason,
        paymentId: payment?.id
      });

      await this.notificationsService.sendToUser(orders[0].userId, {
        title: "Pedido reembolsado",
        body: customerMessage,
        data: {
          type: "ORDER_REFUNDED",
          orderGroupId,
          reason,
          rejectedBusinessId: context.rejectedBusinessId,
          rejectedBusinessName: context.rejectedBusinessName
        }
      });

      await this.notifyBusinessesOrderGroupCancelled(orders, context);
    });
  }

  private async notifyBusinessesOrderGroupCancelled(
    orders: Order[],
    context: {
      rejectedBusinessId?: string;
      rejectedBusinessName?: string;
    }
  ): Promise<void> {
    if (!context.rejectedBusinessId) {
      return;
    }

    const businesses = await Promise.all(
      [...new Set(orders.map((order) => order.businessId))]
        .filter((businessId) => businessId !== context.rejectedBusinessId)
        .map((businessId) => this.businessesService.findById(businessId))
    );
    const ownerIds = businesses.map((business) => business.ownerUserId).filter(Boolean);

    if (!ownerIds.length) {
      return;
    }

    await this.notificationsService.sendToUsers(ownerIds, {
      title: "Multipedido cancelado",
      body: `${context.rejectedBusinessName ?? "Un negocio"} rechazo el pedido. No prepares este multipedido.`,
      data: {
        type: "ORDER_GROUP_CANCELLED",
        orderGroupId: orders[0].orderGroupId,
        reason: "BUSINESS_REJECTED",
        rejectedBusinessId: context.rejectedBusinessId,
        rejectedBusinessName: context.rejectedBusinessName
      }
    });
  }

  private async notifyBusinessesCashPayoutPending(orders: Order[]): Promise<void> {
    for (const order of orders) {
      if (
        order.paymentMethod !== "CASH" ||
        order.businessCashPayoutStatus !== "PENDING" ||
        Number(order.businessPayoutCents ?? 0) <= 0
      ) {
        continue;
      }

      const business = await this.businessesService.findById(order.businessId);

      if (!business.ownerUserId) {
        continue;
      }

      await this.notificationsService.sendToUser(business.ownerUserId, {
        title: "Confirma pago recibido",
        body: `Confirma cuando recibas ${this.formatMoney(order.businessPayoutCents)} ${order.fulfillmentMethod === "PICKUP" ? "del cliente" : "del repartidor"}.`,
        data: {
          type: "BUSINESS_CASH_PAYOUT_PENDING",
          orderGroupId: order.orderGroupId,
          businessOrderId: order.id,
          businessId: order.businessId,
          businessPayoutCents: order.businessPayoutCents
        }
      });
    }
  }

  private async notifyBusinessesProcessableOrders(
    orders: ProcessableBusinessOrderNotification[]
  ): Promise<void> {
    for (const order of orders) {
      const business = await this.businessesService.findById(order.businessId);

      if (!business.ownerUserId) {
        continue;
      }

      const pendingOrderCount = await this.countProcessablePendingOrdersForBusiness(order.businessId);
      const subtotalCents = Number(order.subtotalCents ?? 0);

      await this.notificationsService.sendToUser(business.ownerUserId, {
        title: pendingOrderCount > 1 ? `${pendingOrderCount} pedidos pendientes` : "Nuevo pedido",
        body:
          pendingOrderCount > 1
            ? `Tienes ${pendingOrderCount} pedidos pendientes por aceptar.`
            : `Tienes un pedido nuevo por ${this.formatMoney(subtotalCents)}.`,
        data: {
          type: "NEW_BUSINESS_ORDER",
          orderGroupId: order.orderGroupId,
          businessOrderId: order.id,
          businessId: order.businessId,
          pendingOrderCount
        }
      });
    }
  }

  private async countProcessablePendingOrdersForBusiness(businessId: string): Promise<number> {
    const pendingOrders = await this.orderRepository.find({
      where: { businessId, status: "PENDING" }
    });

    return pendingOrders.filter((order) => this.canBusinessProcessOrder(order)).length;
  }

  private async notifyCustomerOrderStatus(
    orderGroupId: string,
    status: BusinessOrderStatus
  ): Promise<void> {
    const orders = await this.orderRepository.find({ where: { orderGroupId } });
    const [firstOrder] = orders;

    if (!firstOrder) {
      return;
    }

    const message = this.customerBusinessStatusMessage(orders, status);

    await this.notificationsService.sendToUser(firstOrder.userId, {
      title: message.title,
      body: message.body,
      data: { type: "ORDER_STATUS", orderGroupId, status }
    });
  }

  private customerBusinessStatusMessage(
    orders: Order[],
    status: BusinessOrderStatus
  ): { title: string; body: string } {
    const [firstOrder] = orders;

    if (firstOrder?.fulfillmentMethod === "PICKUP" && status === "READY") {
      const readyCount = orders.filter((order) => ["READY", "DELIVERED"].includes(order.status as string)).length;

      if (readyCount < orders.length) {
        return {
          title: "Parte de tu pedido esta lista",
          body: "Una parte de tu multipedido ya esta lista para recoger; espera la confirmacion de las demas partes."
        };
      }

      return {
        title: "Tu pedido esta listo para recoger",
        body: "Puedes pasar al negocio a recoger tu pedido."
      };
    }

    if (firstOrder?.fulfillmentMethod === "PICKUP" && status === "DELIVERED") {
      return {
        title: "Pedido recogido",
        body: "El negocio marco tu pedido como entregado."
      };
    }

    return {
      title: this.notificationTitleForBusinessStatus(status),
      body: this.notificationBodyForBusinessStatus(status)
    };
  }

  private async notifyCustomerIfCourierArrived(orders: Order[]): Promise<void> {
    const [firstOrder] = orders;

    if (
      !firstOrder ||
      firstOrder.arrivalNotifiedAt ||
      firstOrder.customerLatitude === null ||
      firstOrder.customerLatitude === undefined ||
      firstOrder.customerLongitude === null ||
      firstOrder.customerLongitude === undefined ||
      firstOrder.courierLatitude === null ||
      firstOrder.courierLatitude === undefined ||
      firstOrder.courierLongitude === null ||
      firstOrder.courierLongitude === undefined
    ) {
      return;
    }

    const distanceKm = this.distanceInKm(
      {
        latitude: Number(firstOrder.customerLatitude),
        longitude: Number(firstOrder.customerLongitude)
      },
      {
        latitude: Number(firstOrder.courierLatitude),
        longitude: Number(firstOrder.courierLongitude)
      }
    );

    if (distanceKm > 0.08) {
      return;
    }

    for (const order of orders) {
      order.arrivalNotifiedAt = new Date();
    }

    await this.orderRepository.save(orders);
    await this.sendCourierArrivedNotification(firstOrder);
  }

  private async sendCourierArrivedNotification(firstOrder: Order): Promise<void> {
    await this.notificationsService.sendToUser(firstOrder.userId, {
      title: "Tu pedido esta en la puerta",
      body: "El repartidor ya llego a tu ubicacion. Puedes salir a recibir tu pedido.",
      data: { type: "COURIER_ARRIVED", orderGroupId: firstOrder.orderGroupId }
    });
  }

  private notificationTitleForBusinessStatus(status: BusinessOrderStatus): string {
    const titles: Partial<Record<BusinessOrderStatus, string>> = {
      ACCEPTED: "Tu pedido fue aceptado",
      PREPARING: "Tu pedido esta en preparacion",
      READY: "Tu pedido esta listo",
      REJECTED: "Tu pedido fue rechazado",
      DELIVERED: "Tu pedido fue entregado"
    };

    return titles[status] ?? "Actualizacion de tu pedido";
  }

  private notificationBodyForBusinessStatus(status: BusinessOrderStatus): string {
    const bodies: Partial<Record<BusinessOrderStatus, string>> = {
      ACCEPTED: "El negocio acepto tu pedido.",
      PREPARING: "El negocio ya esta preparando tu pedido.",
      READY: "Tu pedido esta listo para que un repartidor lo recoja.",
      REJECTED: "El negocio no pudo aceptar tu pedido.",
      DELIVERED: "Gracias por ordenar en RapiV."
    };

    return bodies[status] ?? "Hay una nueva actualizacion en tu pedido.";
  }

  private notificationTitleForCourierStatus(
    status: "PICKED_UP" | "ON_THE_WAY" | "DELIVERED"
  ): string {
    const titles = {
      PICKED_UP: "Tu pedido fue recogido",
      ON_THE_WAY: "Tu pedido va en camino",
      DELIVERED: "Tu pedido fue entregado"
    };

    return titles[status];
  }

  private notificationBodyForCourierStatus(
    status: "PICKED_UP" | "ON_THE_WAY" | "DELIVERED"
  ): string {
    const bodies = {
      PICKED_UP: "El repartidor ya tiene tu pedido.",
      ON_THE_WAY: "El repartidor va hacia tu ubicacion.",
      DELIVERED: "La entrega fue marcada como completada."
    };

    return bodies[status];
  }

  private mapBusinessOrder(order: Order): BusinessOrder {
    const items = (order.items ?? []).map((item) => {
      const unitPriceCents = Number(item.price);

      return {
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPriceCents,
        lineTotalCents: unitPriceCents * item.quantity

      };
    });

    return {
      id: order.id,
      orderGroupId: order.orderGroupId,
      businessId: order.businessId,
      businessLatitude: this.nullableNumber(order.businessLatitude),
      businessLongitude: this.nullableNumber(order.businessLongitude),
      businessAddress: order.businessAddress,
      paymentMethod: order.paymentMethod,
      fulfillmentMethod: order.fulfillmentMethod,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt,
      cashReceivedCents: order.cashReceivedCents,
      cashChangeCents: order.cashChangeCents,
      cashCollectedAt: order.cashCollectedAt,
      paidAt: order.paidAt,
      status: order.status as BusinessOrderStatus,
      items,
      subtotalCents: order.subtotalCents || items.reduce((sum, item) => sum + item.lineTotalCents, 0),
      businessCommissionCents: order.businessCommissionCents ?? 0,
      businessPayoutCents: order.businessPayoutCents ?? order.subtotalCents,
      businessCashPayoutStatus: order.businessCashPayoutStatus ?? "NOT_APPLICABLE",
      businessCashPayoutConfirmedAt: order.businessCashPayoutConfirmedAt,
      businessCashPayoutConfirmedByUserId: order.businessCashPayoutConfirmedByUserId
    };
  }

  private nullableNumber(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined) {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private groupOrders(orders: Order[]): Order[][] {
    const groups = new Map<string, Order[]>();

    for (const order of orders) {
      if (!order.orderGroupId) {
        continue;
      }

      const groupOrders = groups.get(order.orderGroupId) ?? [];
      groupOrders.push(order);
      groups.set(order.orderGroupId, groupOrders);
    }

    return [...groups.values()];
  }

  private async assertBusinessOwner(ownerUserId: string, businessId: string): Promise<void> {
    const business = await this.businessesService.findById(businessId);

    if (business.ownerUserId !== ownerUserId) {
      throw new ForbiddenException("User does not own this business");
    }
  }

  private async ensureCourierProfile(courierId: string): Promise<CourierProfile> {
    const existingProfile = await this.courierProfileRepository.findOne({
      where: { userId: courierId }
    });

    if (existingProfile) {
      return existingProfile;
    }

    const profile = this.courierProfileRepository.create({
      userId: courierId,
      availabilityStatus: "OFFLINE",
      stripeChargesEnabled: false,
      stripePayoutsEnabled: false,
      stripeDetailsSubmitted: false,
      stripeRequirementsCurrentlyDue: null
    });

    return this.courierProfileRepository.save(profile);
  }

  private async refreshCourierStripeConnectStatusForProfile(profile: CourierProfile): Promise<CourierProfile> {
    if (!profile.stripeConnectedAccountId) {
      return this.resetCourierStripeConnectState(profile);
    }

    const platformAccountId = await this.stripeConnectService.currentPlatformAccountId();

    if (!profile.stripePlatformAccountId || profile.stripePlatformAccountId !== platformAccountId) {
      return this.resetCourierStripeConnectState(profile);
    }

    try {
      const account = await this.stripeConnectService.retrieveAccountStatus(profile.stripeConnectedAccountId);
      profile.stripePlatformAccountId = platformAccountId;
      profile.stripeChargesEnabled = account.chargesEnabled;
      profile.stripePayoutsEnabled = account.payoutsEnabled;
      profile.stripeDetailsSubmitted = account.detailsSubmitted;
      profile.stripeRequirementsCurrentlyDue = account.requirementsCurrentlyDue;
      return this.courierProfileRepository.save(profile);
    } catch (error) {
      if (this.stripeConnectService.isMissingResourceError(error)) {
        return this.resetCourierStripeConnectState(profile);
      }

      throw error;
    }
  }

  private resetCourierStripeConnectState(profile: CourierProfile): Promise<CourierProfile> {
    profile.stripeConnectedAccountId = null;
    profile.stripePlatformAccountId = null;
    profile.stripeChargesEnabled = false;
    profile.stripePayoutsEnabled = false;
    profile.stripeDetailsSubmitted = false;
    profile.stripeRequirementsCurrentlyDue = null;
    return this.courierProfileRepository.save(profile);
  }

  private async enqueueRecoverableCourierPayouts(courierId: string): Promise<void> {
    const orders = await this.orderRepository.find({
      where: { courierId }
    });
    const orderGroupIds = [...new Set(
      orders
        .filter((order) =>
          order.status === "DELIVERED" &&
          order.paymentMethod === "CARD" &&
          order.paymentStatus === "PAID" &&
          ["PENDING", "FAILED"].includes(order.courierPayoutStatus) &&
          Number(order.courierPayoutCents ?? 0) > 0
        )
        .map((order) => order.orderGroupId)
    )];

    for (const orderGroupId of orderGroupIds) {
      await this.paymentProcessingQueue.addCourierPayout(orderGroupId);
    }
  }

  private async ensureDeliveryOffersForGroup(orderGroupId: string): Promise<void> {
    const orders = await this.orderRepository.find({
      where: { orderGroupId },
      relations: ["items"]
    });

    if (!orders.length) {
      return;
    }

    if (!this.hasCollectableOrders(orders) || orders.some((order) => order.courierId)) {
      return;
    }

    const users = await this.userRepository.find();
    const courierIds = users
      .filter((user) => (user.roles ?? []).includes("COURIER"))
      .map((user) => user.id);

    if (!courierIds.length) {
      return;
    }

    const existingOffers = await this.deliveryOfferRepository.find({
      where: { orderGroupId }
    });
    const alreadyOfferedCourierIds = new Set(existingOffers.map((offer) => offer.courierId));
    const blockedCourierIds = await this.blockedCourierIdsForNewOrders();
    const eligibleCourierIds = courierIds.filter(
      (courierId) =>
        !alreadyOfferedCourierIds.has(courierId) &&
        !blockedCourierIds.has(courierId)
    );

    if (!eligibleCourierIds.length) {
      return;
    }

    const profiles = await this.courierProfileRepository.find();
    const availableProfiles = profiles.filter(
      (profile) =>
        eligibleCourierIds.includes(profile.userId) &&
        profile.availabilityStatus === "AVAILABLE"
    );

    const candidates = availableProfiles.length
      ? availableProfiles
      : eligibleCourierIds.map((userId) =>
        this.courierProfileRepository.create({
          userId,
          availabilityStatus: "AVAILABLE"
        })
      );

    const [firstOrder] = orders;
    const scoredCandidates = candidates
      .map((profile) => ({
        profile,
        score: this.scoreCourierForOrder(profile, firstOrder)
      }))
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const eligibleScoredCandidates = [];

    for (const candidate of scoredCandidates) {
      if (await this.hasCashCapacityForOrders(candidate.profile.userId, orders)) {
        eligibleScoredCandidates.push(candidate);
      }
    }

    const expiresAt = new Date(Date.now() + this.deliveryOfferTtlMs());
    const offers = eligibleScoredCandidates.map((candidate) =>
      this.deliveryOfferRepository.create({
        orderGroupId,
        courierId: candidate.profile.userId,
        score: candidate.score,
        status: "PENDING",
        expiresAt
      })
    );

    if (offers.length) {
      await this.deliveryOfferRepository.save(offers);
      await this.orderProcessingQueue.addDeliveryOfferTimeout(orderGroupId);
      this.monitoring?.recordOrderEvent("offers_generated", {
        orderGroupId,
        offerCount: offers.length
      });
      await this.notificationsService.sendToUsers(
        offers.map((offer) => offer.courierId),
        {
          title: "Nueva oferta de entrega",
          body: "Hay un pedido recomendado para tu zona.",
          data: { type: "DELIVERY_OFFER", orderGroupId }
        }
      );
    }
  }

  private async enqueueDeliveryOfferGeneration(orderGroupId: string): Promise<void> {
    await this.orderProcessingQueue.addDeliveryOfferGeneration(orderGroupId);
    this.monitoring?.recordOrderEvent("offer_generation_enqueued", {
      orderGroupId
    });
  }

  private async enqueueReadyDeliveryOfferGenerations(): Promise<void> {
    const orderGroupIds = await this.findReadyOrderGroupIdsWithoutCourier();

    if (!orderGroupIds.length) {
      return;
    }

    await this.orderProcessingQueue.addDeliveryOfferGenerations(orderGroupIds);
    this.monitoring?.recordOrderEvent("available_courier_offer_generation_enqueued", {
      orderGroupCount: orderGroupIds.length
    });
  }

  private async ensureDeliveryOffersForAvailableCourier(courierId: string): Promise<void> {
    if (await this.isCourierBlockedFromNewOrders(courierId)) {
      return;
    }

    const profile = await this.courierProfileRepository.findOne({
      where: { userId: courierId }
    });

    if (profile && profile.availabilityStatus !== "AVAILABLE") {
      return;
    }

    const orderGroupIds = await this.findReadyOrderGroupIdsWithoutCourier();

    for (const orderGroupId of orderGroupIds) {
      await this.ensureDeliveryOffersForGroup(orderGroupId);
    }
  }

  private async findReadyOrderGroupIdsWithoutCourier(): Promise<string[]> {
    const readyOrders = await this.orderRepository.find({
      where: { status: "READY" }
    });
    const orderGroupIds = [...new Set(readyOrders.map((order) => order.orderGroupId).filter(Boolean))];
    const readyOrderGroupIds: string[] = [];

    for (const orderGroupId of orderGroupIds) {
      const orders = await this.orderRepository.find({
        where: { orderGroupId }
      });

      if (!orders.length || orders.some((order) => order.courierId)) {
        continue;
      }

      if (this.hasCollectableOrders(orders)) {
        readyOrderGroupIds.push(orderGroupId);
      }
    }

    return readyOrderGroupIds;
  }

  private async assertCourierCanReceiveNewOrders(courierId: string): Promise<void> {
    const profile = await this.ensureCourierProfile(courierId);

    if (!profile.stripeConnectedAccountId || !profile.stripePayoutsEnabled) {
      throw new ConflictException(
        "Configura Stripe Connect en tu perfil antes de recibir pedidos."
      );
    }

    if (await this.isCourierBlockedFromNewOrders(courierId)) {
      throw new ConflictException(
        "Configura Stripe Connect en tu perfil antes de recibir pedidos."
      );
    }
  }

  private async isCourierBlockedFromNewOrders(courierId: string): Promise<boolean> {
    const profile = await this.courierProfileRepository.findOne({
      where: { userId: courierId }
    });

    return !profile || !profile.stripeConnectedAccountId || !profile.stripePayoutsEnabled;
  }

  private async blockedCourierIdsForNewOrders(): Promise<Set<string>> {
    const profiles = await this.courierProfileRepository.find();
    return new Set(
      profiles
        .filter((profile) => !profile.stripeConnectedAccountId || !profile.stripePayoutsEnabled)
        .map((profile) => profile.userId)
    );
  }

  private async hasCashCapacityForOrders(courierId: string, orders: Order[]): Promise<boolean> {
    try {
      await this.courierWalletService.assertCanCoverCashOrders(courierId, orders);
      return true;
    } catch (error) {
      if (error instanceof ConflictException) {
        return false;
      }

      throw error;
    }
  }

  private formatMoney(cents: number): string {
    return `$${(Number(cents ?? 0) / 100).toFixed(2)}`;
  }

  private scoreCourierForOrder(profile: CourierProfile, order: Order): number {
    const businessLocation =
      order.businessLatitude !== null &&
        order.businessLatitude !== undefined &&
        order.businessLongitude !== null &&
        order.businessLongitude !== undefined
        ? {
          latitude: Number(order.businessLatitude),
          longitude: Number(order.businessLongitude)
        }
        : null;

    if (
      !businessLocation ||
      profile.preferredLatitude === null ||
      profile.preferredLatitude === undefined ||
      profile.preferredLongitude === null ||
      profile.preferredLongitude === undefined
    ) {
      return 5000;
    }

    const distanceKm = this.distanceInKm(
      {
        latitude: Number(profile.preferredLatitude),
        longitude: Number(profile.preferredLongitude)
      },
      businessLocation
    );
    const maxDistance = profile.maxDeliveryDistanceKm ?? profile.preferredRadiusKm ?? 35;

    if (distanceKm > maxDistance) {
      return 0;
    }

    const preferredRadius = profile.preferredRadiusKm ?? maxDistance;
    const zoneBonus = distanceKm <= preferredRadius ? 3000 : 0;
    return Math.max(1, Math.round(10000 + zoneBonus - distanceKm * 100));
  }

  private async expireStaleOffers(): Promise<void> {
    const offers = await this.deliveryOfferRepository.find({
      where: { status: "PENDING" }
    });
    const expiredOffers = offers.filter((offer) => offer.expiresAt.getTime() <= Date.now());

    if (!expiredOffers.length) {
      return;
    }

    for (const offer of expiredOffers) {
      offer.status = "EXPIRED";
    }

    await this.deliveryOfferRepository.save(expiredOffers);
  }

  private deliveryOfferTtlMs(): number {
    const configuredMinutes = Number(process.env.DELIVERY_OFFER_TTL_MINUTES ?? 15);
    const safeMinutes = Number.isFinite(configuredMinutes) && configuredMinutes > 0
      ? configuredMinutes
      : 15;

    return safeMinutes * 60 * 1000;
  }

  private distanceInKm(
    from: { latitude: number; longitude: number },
    to: { latitude: number; longitude: number }
  ): number {
    const earthRadiusKm = 6371;
    const dLat = this.toRadians(to.latitude - from.latitude);
    const dLon = this.toRadians(to.longitude - from.longitude);
    const lat1 = this.toRadians(from.latitude);
    const lat2 = this.toRadians(to.latitude);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRadians(value: number): number {
    return (value * Math.PI) / 180;
  }

  private assertValidTransition(
    currentStatus: BusinessOrderStatus,
    nextStatus: BusinessOrderStatus
  ): void {
    const allowedTransitions: Record<BusinessOrderStatus, BusinessOrderStatus[]> = {
      PENDING: ["ACCEPTED", "REJECTED"],
      ACCEPTED: ["PREPARING", "REJECTED"],
      PREPARING: ["READY"],
      READY: ["DELIVERED"],
      ASSIGNED: [],
      PICKED_UP: [],
      ON_THE_WAY: [],
      REJECTED: [],
      DELIVERED: [],
      CANCELLED: []
    };

    if (!allowedTransitions[currentStatus]?.includes(nextStatus)) {
      throw new ConflictException(`Invalid transition from ${currentStatus} to ${nextStatus}`);
    }
  }

  private assertValidCourierTransition(
    currentStatuses: BusinessOrderStatus[],
    nextStatus: "PICKED_UP" | "ON_THE_WAY" | "DELIVERED"
  ): void {
    const currentStatus = this.deriveOrderGroupStatus(currentStatuses);
    const hasAssignedOrReadyOrder = currentStatuses.some((status) =>
      ["ASSIGNED", "READY"].includes(status)
    );
    const allPickedUp = currentStatuses.every((status) => status === "PICKED_UP");
    const allOnTheWay = currentStatuses.every((status) => status === "ON_THE_WAY");

    if (nextStatus === "PICKED_UP" && hasAssignedOrReadyOrder) {
      return;
    }

    if (nextStatus === "ON_THE_WAY" && allPickedUp) {
      return;
    }

    if (nextStatus === "DELIVERED" && allOnTheWay) {
      return;
    }

    if (nextStatus === "ON_THE_WAY" && currentStatus === "PARTIALLY_PICKED_UP") {
      throw new ConflictException("All business orders must be picked up before starting delivery");
    }

    if (nextStatus === "DELIVERED" && currentStatus === "PICKED_UP") {
      throw new ConflictException("Order must be on the way before delivery");
    }

    throw new ConflictException(`Invalid transition from ${currentStatus} to ${nextStatus}`);
  }

  private isDeliveryLocationVisible(statuses: BusinessOrderStatus[]): boolean {
    const status = this.deriveOrderGroupStatus(statuses);
    return ["ASSIGNED", "PARTIALLY_PICKED_UP", "PICKED_UP", "ON_THE_WAY"].includes(status);
  }

  private deriveOrderGroupStatus(statuses: BusinessOrderStatus[]): OrderGroupStatus {
    if (statuses.every((status) => status === "CANCELLED")) {
      return "CANCELLED";
    }

    if (statuses.every((status) => status === "REJECTED")) {
      return "REJECTED";
    }

    if (statuses.every((status) => status === "REJECTED" || status === "CANCELLED")) {
      return "CANCELLED";
    }

    if (statuses.every((status) => status === "DELIVERED")) {
      return "DELIVERED";
    }

    if (statuses.every((status) => status === "ON_THE_WAY")) {
      return "ON_THE_WAY";
    }

    if (statuses.every((status) => status === "PICKED_UP")) {
      return "PICKED_UP";
    }

    if (statuses.some((status) => status === "PICKED_UP")) {
      return "PARTIALLY_PICKED_UP";
    }

    if (statuses.every((status) => status === "ASSIGNED")) {
      return "ASSIGNED";
    }

    if (statuses.some((status) => status === "ASSIGNED")) {
      return "ASSIGNED";
    }

    if (statuses.every((status) => status === "READY")) {
      return "READY_FOR_PICKUP";
    }

    if (statuses.some((status) => status === "READY")) {
      return "PARTIALLY_READY";
    }

    if (statuses.some((status) => status === "PREPARING")) {
      return "PREPARING";
    }

    if (statuses.every((status) => status === "ACCEPTED")) {
      return "ACCEPTED_BY_BUSINESS";
    }

    if (statuses.some((status) => status === "ACCEPTED")) {
      return "PARTIALLY_ACCEPTED";
    }

    return "PENDING_BUSINESS";
  }

  private hasCollectableOrders(orders: Order[]): boolean {
    return orders[0]?.fulfillmentMethod !== "PICKUP" && orders.some((order) => order.status === "READY");
  }

  private canBusinessProcessOrder(order: Order): boolean {
    return order.paymentStatus === "PAID" || order.paymentMethod === "CASH";
  }

  private providerTransfersFromMetadata(
    metadata: Record<string, unknown> | null | undefined
  ): ProviderTransfer[] {
    const transfers = metadata?.stripeTransfers;

    if (!Array.isArray(transfers)) {
      return [];
    }

    return transfers.map((transfer) => {
      const value = transfer as Record<string, unknown>;

      return {
        businessId: String(value.businessId),
        connectedAccountId: String(value.connectedAccountId),
        providerTransferId: String(value.providerTransferId),
        amountCents: Number(value.amountCents)
      };
    }).filter((transfer) =>
      transfer.businessId &&
      transfer.connectedAccountId &&
      transfer.providerTransferId &&
      Number.isInteger(transfer.amountCents) &&
      transfer.amountCents > 0
    );
  }

  private assertBusinessCheckoutRules(
    business: Business,
    paymentMethod: "CARD" | "CASH"
  ): void {
    if (paymentMethod === "CASH" && business.acceptsCash === false) {
      throw new ConflictException(`${business.name} does not accept cash payments`);
    }

    if (paymentMethod === "CARD" && business.acceptsCard === false) {
      throw new ConflictException(`${business.name} does not accept card payments`);
    }
  }

  private assertCashCollectionForDelivery(orders: Order[], cashReceivedCents?: number): void {
    const [firstOrder] = orders;

    if (firstOrder?.paymentMethod !== "CASH") {
      return;
    }

    const totalCents = this.totalCentsForOrders(orders);

    if (cashReceivedCents === undefined) {
      throw new BadRequestException("Cash received amount is required");
    }

    if (cashReceivedCents < totalCents) {
      throw new ConflictException("Cash received is less than order total");
    }
  }

  private totalCentsForOrders(orders: Order[]): number {
    return orders.reduce(
      (sum, order) => sum + Number(order.subtotalCents ?? 0) + Number(order.deliveryFeeCents ?? 0),
      0
    );
  }

  private deliveryFeeCents(): number {
    return this.nonNegativeIntegerEnv("DELIVERY_FEE_CENTS", 0);
  }

  private courierPayoutCents(): number {
    const payoutCents = this.nonNegativeIntegerEnv("COURIER_PAYOUT_CENTS", 0);
    const deliveryFeeCents = this.deliveryFeeCents();

    if (payoutCents > deliveryFeeCents) {
      throw new Error("COURIER_PAYOUT_CENTS cannot be greater than DELIVERY_FEE_CENTS");
    }

    return payoutCents;
  }

  private platformFeeBasisPoints(paymentMethod: "CARD" | "CASH"): number {
    const key = paymentMethod === "CASH" ? "RAPIV_CASH_PLATFORM_FEE_BPS" : "RAPIV_PLATFORM_FEE_BPS";
    const fallback = paymentMethod === "CASH"
      ? this.nonNegativeIntegerEnv("RAPIV_PLATFORM_FEE_BPS", 0)
      : 0;
    const configured = this.nonNegativeIntegerEnv(key, fallback);

    if (configured >= 10_000) {
      throw new Error(`${key} must be an integer between 0 and 9999`);
    }

    return configured;
  }

  private assertCardPaymentMinimum(paymentMethod: "CARD" | "CASH", subtotalCents: number): void {
    if (paymentMethod !== "CARD") {
      return;
    }

    const minimumCents = this.cardPaymentMinimumCents();

    if (subtotalCents < minimumCents) {
      throw new ConflictException(
        `Los pedidos con tarjeta requieren minimo ${this.formatMoney(minimumCents)} en productos. Usa efectivo para pedidos menores.`
      );
    }
  }

  private cardPaymentMinimumCents(): number {
    return this.nonNegativeIntegerEnv("CARD_PAYMENT_MINIMUM_CENTS", 18_000);
  }

  private nonNegativeIntegerEnv(key: string, fallback: number): number {
    const rawValue = process.env[key];
    const value = rawValue === undefined ? fallback : Number(rawValue);

    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`${key} must be a non-negative integer`);
    }

    return value;
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "23505"
    );
  }
}
