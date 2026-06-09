import { Body, Controller, ForbiddenException, Get, Headers, Param, Patch, Post } from "@nestjs/common";

import { CurrentUser } from "../../common/auth/current-user.decorator";
import { AuthenticatedUser } from "../../common/auth/jwt-auth.guard";
import { LocationDto } from "../../common/geo/location.dto";
import { CreateOrderDto } from "./dto/create-order.dto";
import { UpdateCourierAvailabilityDto } from "./dto/update-courier-availability.dto";
import { UpdateBusinessOrderStatusDto } from "./dto/update-business-order-status.dto";
import { UpdateCourierDeliveryStatusDto } from "./dto/update-courier-delivery-status.dto";
import { OrdersService } from "./orders.service";

@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() dto: CreateOrderDto
  ) {
    return this.ordersService.create(user.sub, idempotencyKey, dto);
  }

  @Get("mine")
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.findByCustomer(user.sub);
  }

  @Get("ready")
  findReady(@CurrentUser() user: AuthenticatedUser) {
    if (!user.roles.includes("COURIER")) {
      throw new ForbiddenException("Only couriers can access ready orders");
    }

    return this.ordersService.findReadyForCourier(user.sub);
  }

  @Get("courier/mine")
  findCourierMine(@CurrentUser() user: AuthenticatedUser) {
    if (!user.roles.includes("COURIER")) {
      throw new ForbiddenException("Only couriers can access assigned orders");
    }

    return this.ordersService.findAssignedToCourier(user.sub);
  }

  @Patch("courier/availability")
  updateCourierAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCourierAvailabilityDto
  ) {
    if (!user.roles.includes("COURIER")) {
      throw new ForbiddenException("Only couriers can update availability");
    }

    return this.ordersService.updateCourierAvailability(user.sub, dto);
  }

  @Get("courier/stripe/profile")
  getCourierStripeProfile(@CurrentUser() user: AuthenticatedUser) {
    if (!user.roles.includes("COURIER")) {
      throw new ForbiddenException("Only couriers can access Stripe Connect profile");
    }

    return this.ordersService.getCourierStripeConnectProfile(user.sub);
  }

  @Post("courier/stripe/connect-account")
  createCourierStripeConnectAccount(@CurrentUser() user: AuthenticatedUser) {
    if (!user.roles.includes("COURIER")) {
      throw new ForbiddenException("Only couriers can configure Stripe Connect");
    }

    return this.ordersService.createCourierStripeConnectAccount(user.sub);
  }

  @Post("courier/stripe/onboarding-link")
  createCourierStripeOnboardingLink(@CurrentUser() user: AuthenticatedUser) {
    if (!user.roles.includes("COURIER")) {
      throw new ForbiddenException("Only couriers can configure Stripe Connect");
    }

    return this.ordersService.createCourierStripeOnboardingLink(user.sub);
  }

  @Post("courier/stripe/refresh-status")
  refreshCourierStripeConnectStatus(@CurrentUser() user: AuthenticatedUser) {
    if (!user.roles.includes("COURIER")) {
      throw new ForbiddenException("Only couriers can refresh Stripe Connect status");
    }

    return this.ordersService.refreshCourierStripeConnectStatus(user.sub);
  }

  @Get("courier/offers")
  findCourierOffers(@CurrentUser() user: AuthenticatedUser) {
    if (!user.roles.includes("COURIER")) {
      throw new ForbiddenException("Only couriers can access delivery offers");
    }

    return this.ordersService.findOffersForCourier(user.sub);
  }

  @Patch("courier/offers/:offerId/accept")
  acceptCourierOffer(
    @CurrentUser() user: AuthenticatedUser,
    @Param("offerId") offerId: string
  ) {
    if (!user.roles.includes("COURIER")) {
      throw new ForbiddenException("Only couriers can accept delivery offers");
    }

    return this.ordersService.acceptDeliveryOffer(user.sub, offerId);
  }

  @Get("businesses/:businessId/pending")
  async findPendingForBusiness(
    @CurrentUser() user: AuthenticatedUser,
    @Param("businessId") businessId: string
  ) {
    return this.ordersService.findPendingForBusiness(user.sub, businessId);
  }

  @Patch("businesses/:businessId/suborders/:businessOrderId/status")
  async updateBusinessOrderStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param("businessId") businessId: string,
    @Param("businessOrderId") businessOrderId: string,
    @Body() dto: UpdateBusinessOrderStatusDto
  ) {
    return this.ordersService.updateBusinessOrderStatus(
      user.sub,
      businessId,
      businessOrderId,
      dto.status
    );
  }

  @Patch("businesses/:businessId/suborders/:businessOrderId/cash-payout/confirm")
  async confirmBusinessCashPayout(
    @CurrentUser() user: AuthenticatedUser,
    @Param("businessId") businessId: string,
    @Param("businessOrderId") businessOrderId: string
  ) {
    return this.ordersService.confirmBusinessCashPayout(
      user.sub,
      businessId,
      businessOrderId
    );
  }

  @Patch(":orderGroupId/assign")
  assignToCourier(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderGroupId") orderGroupId: string
  ) {
    if (!user.roles.includes("COURIER")) {
      throw new ForbiddenException("Only couriers can assign orders");
    }

    return this.ordersService.assignToCourier(user.sub, orderGroupId);
  }

  @Patch(":orderGroupId/delivery-status")
  updateDeliveryStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderGroupId") orderGroupId: string,
    @Body() dto: UpdateCourierDeliveryStatusDto
  ) {
    if (!user.roles.includes("COURIER")) {
      throw new ForbiddenException("Only couriers can update delivery status");
    }

    return this.ordersService.updateCourierDeliveryStatus(
      user.sub,
      orderGroupId,
      dto.status,
      dto.cashReceivedCents
    );
  }

  @Patch(":orderGroupId/suborders/:businessOrderId/pickup")
  markBusinessOrderPickedUp(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderGroupId") orderGroupId: string,
    @Param("businessOrderId") businessOrderId: string
  ) {
    if (!user.roles.includes("COURIER")) {
      throw new ForbiddenException("Only couriers can update delivery status");
    }

    return this.ordersService.markBusinessOrderPickedUp(user.sub, orderGroupId, businessOrderId);
  }

  @Patch(":orderGroupId/customer-location")
  updateCustomerLocation(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderGroupId") orderGroupId: string,
    @Body() dto: LocationDto
  ) {
    return this.ordersService.updateCustomerLocation(user.sub, orderGroupId, dto);
  }

  @Patch(":orderGroupId/courier-location")
  updateCourierLocation(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderGroupId") orderGroupId: string,
    @Body() dto: LocationDto
  ) {
    if (!user.roles.includes("COURIER")) {
      throw new ForbiddenException("Only couriers can update courier location");
    }

    return this.ordersService.updateCourierLocation(user.sub, orderGroupId, dto);
  }

  @Patch(":orderGroupId/arrival-notification")
  notifyCustomerCourierArrived(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderGroupId") orderGroupId: string
  ) {
    if (!user.roles.includes("COURIER")) {
      throw new ForbiddenException("Only couriers can notify arrival");
    }

    return this.ordersService.notifyCustomerCourierArrived(user.sub, orderGroupId);
  }

  @Get(":orderGroupId/delivery-location")
  getDeliveryLocation(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderGroupId") orderGroupId: string
  ) {
    return this.ordersService.getDeliveryLocation(user.sub, orderGroupId);
  }

  @Get(":orderId")
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("orderId") orderId: string) {
    return this.ordersService.findByIdForUser(orderId, user);
  }
}
