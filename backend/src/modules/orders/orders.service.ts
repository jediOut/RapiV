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

export type DeliveryOfferSummary = {
  id: string;
  status: string;
  score: number;
  expiresAt: Date;
  order: OrderGroup;
};

@Injectable()
export class OrdersService {
  private readonly pendingCreations = new Map<string, Promise<OrderGroup>>();

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
    private readonly dataSource: DataSource,
    private readonly businessesService: BusinessesService,
    private readonly orderProcessingQueue: OrderProcessingQueue,
    private readonly notificationsService: NotificationsService,
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

    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      assertInsideVegaServiceaddress({
        latitude: dto.latitude,
        longitude: dto.longitude
      });
    }

    try {
      return await this.dataSource.transaction(async (manager) => {

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

          const unitPriceCents = Number(product.priceCents);
          const lineItem: OrderItemSnapshot = {
            productId: product.id,
            productName: product.name,
            quantity: item.quantity,
            unitPriceCents,
            lineTotalCents: unitPriceCents * item.quantity
          };

          const items = businessOrderItems.get(product.businessId) ?? [];
          items.push(lineItem);
          businessOrderItems.set(product.businessId, items);
        }

        const orderGroupId = randomUUID();
        let shouldStoreIdempotencyKey = true;

        for (const [businessId, items] of businessOrderItems.entries()) {

          const business = await manager.findOne(Business, {
            where: { id: businessId }
          });
          if (!business) {
            throw new NotFoundException("Business not found");
          }

          const subtotalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
          const order = manager.create(Order, {
            userId: customerId,
            businessId,
            orderGroupId,
            idempotencyKey: shouldStoreIdempotencyKey ? idempotencyKey : null,
            status: "PENDING",
            subtotalCents,
            totalPrice: subtotalCents / 100,
            deliveryAddress: dto.deliveryAddress.trim(),
            customerLatitude: dto.latitude,
            customerLongitude: dto.longitude,
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
          await manager.save(Order, order);
        }

        const orderGroup = await this.loadOrderGroup(orderGroupId, manager);
        this.monitoring?.recordOrderEvent("created", {
          orderGroupId,
          customerId,
          businessOrderCount: orderGroup.businessOrders.length,
          totalCents: orderGroup.totalCents
        });
        return orderGroup;
      });
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

  async findReadyForCourier(): Promise<OrderGroup[]> {
    const orders = await this.orderRepository.find({
      relations: ["items"],
      order: { createdAt: "DESC" }
    });
    const groups = this.groupOrders(orders);
    const readyGroups = groups.filter((groupOrders) =>
      this.deriveOrderGroupStatus(groupOrders.map((order) => order.status as BusinessOrderStatus)) ===
      "READY_FOR_PICKUP"
    );

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

    if (nextStatus !== "REJECTED" && order.paymentStatus !== "PAID") {
      throw new ConflictException("Order must be paid before business processing");
    }

    this.assertValidTransition(order.status as BusinessOrderStatus, nextStatus);
    order.status = nextStatus;
    const savedOrder = await this.orderRepository.save(order);
    savedOrder.items = order.items;

    if (nextStatus === "READY") {
      await this.enqueueDeliveryOfferGeneration(order.orderGroupId);
    }
    this.monitoring?.recordOrderEvent("business_status_updated", {
      orderGroupId: order.orderGroupId,
      businessOrderId: order.id,
      businessId,
      status: nextStatus
    });
    await this.notifyCustomerOrderStatus(order.orderGroupId, nextStatus);

    return this.mapBusinessOrder(savedOrder);
  }

  async updateCourierAvailability(
    courierId: string,
    dto: UpdateCourierAvailabilityDto
  ): Promise<CourierProfile> {
    if (dto.latitude !== undefined || dto.longitude !== undefined) {
      if (dto.latitude === undefined || dto.longitude === undefined) {
        throw new BadRequestException("Both latitude and longitude are required");
      }

      assertInsideVegaServiceaddress({
        latitude: dto.latitude,
        longitude: dto.longitude
      });
    }

    const profile = this.courierProfileRepository.create({
      userId: courierId,
      availabilityStatus: dto.status,
      preferredLatitude: dto.latitude,
      preferredLongitude: dto.longitude,
      preferredRadiusKm: dto.preferredRadiusKm ?? 35,
      maxDeliveryDistanceKm: dto.maxDeliveryDistanceKm ?? 35
    });

    return this.courierProfileRepository.save(profile);
  }

  async findOffersForCourier(courierId: string): Promise<DeliveryOfferSummary[]> {
    await this.expireStaleOffers();

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

        if (courierOrder.status === "READY_FOR_PICKUP") {
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

      const groupStatus = this.deriveOrderGroupStatus(
        orders.map((order) => order.status as BusinessOrderStatus)
      );

      if (groupStatus !== "READY_FOR_PICKUP") {
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

  async acceptDeliveryOffer(courierId: string, offerId: string): Promise<OrderGroup> {
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

      const groupStatus = this.deriveOrderGroupStatus(
        orders.map((order) => order.status as BusinessOrderStatus)
      );

      if (groupStatus !== "READY_FOR_PICKUP") {
        offer.status = "CANCELLED";
        await manager.save(DeliveryOffer, offer);
        throw new ConflictException("Order is no longer ready for pickup");
      }

      if (orders.some((order) => order.courierId && order.courierId !== courierId)) {
        offer.status = "CANCELLED";
        await manager.save(DeliveryOffer, offer);
        throw new ConflictException("Order is already assigned to another courier");
      }

      for (const order of orders) {
        order.courierId = courierId;
        order.status = "ASSIGNED";
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
    return this.dataSource.transaction(async (manager) => {

      const orders = await manager.find(Order, {
        where: { orderGroupId },
        lock: { mode: "pessimistic_write" }
      });

      if (!orders.length) {
        throw new NotFoundException("Order not found");
      }

      const groupStatus = this.deriveOrderGroupStatus(
        orders.map((order) => order.status as BusinessOrderStatus)
      );

      if (groupStatus !== "READY_FOR_PICKUP") {
        throw new ConflictException("Order is not ready for pickup");
      }

      if (orders.some((order) => order.courierId && order.courierId !== courierId)) {
        throw new ConflictException("Order is already assigned to another courier");
      }

      for (const order of orders) {
        order.courierId = courierId;
        order.status = "ASSIGNED";

        order.items = await manager.find(OrderItem, {
          where: { orderId: order.id }
        });
      }

      await manager.save(Order, orders);

      return this.attachCustomerDetails(this.mapCourierOrderGroup(orders));
    });
  }

  async updateCourierDeliveryStatus(
    courierId: string,
    orderGroupId: string,
    nextStatus: "PICKED_UP" | "ON_THE_WAY" | "DELIVERED"
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

      const currentStatus = this.deriveOrderGroupStatus(
        orders.map((order) => order.status as BusinessOrderStatus)
      );

      this.assertValidCourierTransition(currentStatus, nextStatus);

      for (const order of orders) {
        order.status = nextStatus;

        order.items = await manager.find(OrderItem, {
          where: { orderId: order.id }
        });
      }

      await manager.save(Order, orders);
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

      await this.notificationsService.sendToUser(orders[0].userId, {
        title: this.notificationTitleForCourierStatus(nextStatus),
        body: this.notificationBodyForCourierStatus(nextStatus),
        data: { type: "ORDER_STATUS", orderGroupId, status: nextStatus }
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

    return {
      id: firstOrder.orderGroupId,
      customerId: firstOrder.userId,
      deliveryAddress: firstOrder.deliveryAddress,
      status: this.deriveOrderGroupStatus(
        businessOrders.map((businessOrder) => businessOrder.status)
      ),
      businessOrders,
      totalCents: businessOrders.reduce(
        (sum, businessOrder) => sum + businessOrder.subtotalCents,
        0
      ),
      createdAt: firstOrder.createdAt,
      courierId: firstOrder.courierId,
      paymentStatus: firstOrder.paymentStatus,
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

  private async notifyCustomerOrderStatus(
    orderGroupId: string,
    status: BusinessOrderStatus
  ): Promise<void> {
    const orders = await this.orderRepository.find({ where: { orderGroupId } });
    const [firstOrder] = orders;

    if (!firstOrder) {
      return;
    }

    await this.notificationsService.sendToUser(firstOrder.userId, {
      title: this.notificationTitleForBusinessStatus(status),
      body: this.notificationBodyForBusinessStatus(status),
      data: { type: "ORDER_STATUS", orderGroupId, status }
    });
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
    await this.notificationsService.sendToUser(firstOrder.userId, {
      title: "Tu pedido esta en la puerta",
      body: "El repartidor ya esta muy cerca de tu ubicacion.",
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
      businessLatitude: order.businessLatitude,
      businessLongitude: order.businessLongitude,
      businessAddress: order.businessAddress,
      paymentStatus: order.paymentStatus,
      paidAt: order.paidAt,
      status: order.status as BusinessOrderStatus,
      items,
      subtotalCents: order.subtotalCents || items.reduce((sum, item) => sum + item.lineTotalCents, 0)
    };
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

  private async ensureDeliveryOffersForGroup(orderGroupId: string): Promise<void> {
    const orders = await this.orderRepository.find({
      where: { orderGroupId },
      relations: ["items"]
    });

    if (!orders.length) {
      return;
    }

    const groupStatus = this.deriveOrderGroupStatus(
      orders.map((order) => order.status as BusinessOrderStatus)
    );

    if (groupStatus !== "READY_FOR_PICKUP" || orders.some((order) => order.courierId)) {
      return;
    }

    const existingOffer = await this.deliveryOfferRepository.findOne({
      where: { orderGroupId, status: "PENDING" }
    });

    if (existingOffer) {
      return;
    }

    const users = await this.userRepository.find();
    const courierIds = users
      .filter((user) => (user.roles ?? []).includes("COURIER"))
      .map((user) => user.id);

    if (!courierIds.length) {
      return;
    }

    const profiles = await this.courierProfileRepository.find();
    const availableProfiles = profiles.filter(
      (profile) =>
        courierIds.includes(profile.userId) &&
        profile.availabilityStatus === "AVAILABLE"
    );

    const candidates = availableProfiles.length
      ? availableProfiles
      : courierIds.map((userId) =>
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

    const expiresAt = new Date(Date.now() + this.deliveryOfferTtlMs());
    const offers = scoredCandidates.map((candidate) =>
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
    currentStatus: OrderGroupStatus,
    nextStatus: "PICKED_UP" | "ON_THE_WAY" | "DELIVERED"
  ): void {
    const allowedTransitions: Record<string, Array<"PICKED_UP" | "ON_THE_WAY" | "DELIVERED">> = {
      ASSIGNED: ["PICKED_UP"],
      PICKED_UP: ["ON_THE_WAY"],
      ON_THE_WAY: ["DELIVERED"]
    };

    if (!allowedTransitions[currentStatus]?.includes(nextStatus)) {
      throw new ConflictException(`Invalid transition from ${currentStatus} to ${nextStatus}`);
    }
  }

  private isDeliveryLocationVisible(statuses: BusinessOrderStatus[]): boolean {
    const status = this.deriveOrderGroupStatus(statuses);
    return ["ASSIGNED", "PICKED_UP", "ON_THE_WAY"].includes(status);
  }

  private deriveOrderGroupStatus(statuses: BusinessOrderStatus[]): OrderGroupStatus {
    if (statuses.every((status) => status === "REJECTED")) {
      return "REJECTED";
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

    if (statuses.every((status) => status === "ASSIGNED")) {
      return "ASSIGNED";
    }

    if (statuses.every((status) => status === "READY")) {
      return "READY_FOR_PICKUP";
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

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "23505"
    );
  }
}
