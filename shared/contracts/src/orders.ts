export type BusinessOrderStatus =
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "PREPARING"
  | "READY"
  | "ASSIGNED"
  | "PICKED_UP"
  | "ON_THE_WAY"
  | "DELIVERED"
  | "CANCELLED";

export type OrderGroupStatus =
  | "PENDING_BUSINESS"
  | "REJECTED"
  | "READY_FOR_PICKUP"
  | "PARTIALLY_READY"
  | "ACCEPTED_BY_BUSINESS"
  | "PARTIALLY_ACCEPTED"
  | "PREPARING"
  | "READY"
  | "ASSIGNED"
  | "PICKED_UP"
  | "PARTIALLY_PICKED_UP"
  | "ON_THE_WAY"
  | "DELIVERED"
  | "CANCELLED";

export type CourierDeliveryStatus = "PICKED_UP" | "ON_THE_WAY" | "DELIVERED";
export type OrderPaymentMethod = "CARD" | "CASH";
export type OrderFulfillmentMethod = "DELIVERY" | "PICKUP";
export type OrderPaymentStatus = "UNPAID" | "PAID" | "REFUNDED";
export type CourierPayoutStatus = "NOT_APPLICABLE" | "PENDING" | "PAID" | "FAILED" | "CANCELLED";
export type BusinessCashPayoutStatus = "NOT_APPLICABLE" | "PENDING" | "CONFIRMED" | "CANCELLED";

export const ACTIVE_DELIVERY_STATUSES = ["ASSIGNED", "PARTIALLY_PICKED_UP", "PICKED_UP", "ON_THE_WAY"] as const;

export type OrderItemSnapshot = {
  productId: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  minimumQuantityPerOrder?: number;
};

export type BusinessOrder = {
  id: string;
  orderGroupId: string;
  businessId: string;
  status: BusinessOrderStatus;
  items: OrderItemSnapshot[];
  subtotalCents: number;
  businessCommissionCents?: number;
  businessPayoutCents?: number;
  businessCashPayoutStatus?: BusinessCashPayoutStatus;
  businessCashPayoutConfirmedAt?: string | Date | null;
  businessCashPayoutConfirmedByUserId?: string | null;
  businessLatitude?: number | null;
  businessLongitude?: number | null;
  businessAddress?: string | null;
  paymentMethod?: OrderPaymentMethod;
  fulfillmentMethod?: OrderFulfillmentMethod;
  paymentStatus?: OrderPaymentStatus;
  createdAt?: string | Date;
  cashReceivedCents?: number | null;
  cashChangeCents?: number | null;
  cashCollectedAt?: string | Date | null;
  paidAt?: string | Date | null;
};

export type OrderGroup = {
  id: string;
  customerId: string;
  deliveryAddress: string;
  fulfillmentMethod?: OrderFulfillmentMethod;
  status: OrderGroupStatus;
  businessOrders: BusinessOrder[];
  subtotalCents: number;
  deliveryFeeCents: number;
  courierPayoutCents: number;
  courierPayoutStatus?: CourierPayoutStatus;
  courierPayoutPaidAt?: string | Date | null;
  courierPayoutProviderTransferId?: string | null;
  courierPayoutFailedAt?: string | Date | null;
  courierPayoutError?: string | null;
  platformDeliveryMarginCents: number;
  cashSettlementRequiredCents?: number;
  totalCents: number;
  createdAt: string | Date;
  customerName?: string;
  customerPhone?: string;
  courierId?: string | null;
  items?: OrderItemSnapshot[];
  paymentMethod?: OrderPaymentMethod;
  paymentStatus?: OrderPaymentStatus;
  cashReceivedCents?: number | null;
  cashChangeCents?: number | null;
  cashCollectedAt?: string | Date | null;
  paidAt?: string | Date | null;
};

export type CreateOrderItemPayload = {
  productId: string;
  quantity: number;
};

export type CreateOrderPayload = {
  deliveryAddress: string;
  items: CreateOrderItemPayload[];
  paymentMethod?: OrderPaymentMethod;
  fulfillmentMethod?: OrderFulfillmentMethod;
  latitude?: number;
  longitude?: number;
};

export type UpdateBusinessOrderStatusPayload = {
  status: Extract<BusinessOrderStatus, "ACCEPTED" | "PREPARING" | "READY" | "REJECTED" | "DELIVERED">;
};

export type UpdateCourierDeliveryStatusPayload = {
  status: CourierDeliveryStatus;
  cashReceivedCents?: number;
};

export type DeliveryLocation = {
  customer: { latitude: number; longitude: number } | null;
  courier: { latitude: number; longitude: number } | null;
};
