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
  | "ACCEPTED_BY_BUSINESS"
  | "PARTIALLY_ACCEPTED"
  | "PREPARING"
  | "READY"
  | "ASSIGNED"
  | "PICKED_UP"
  | "ON_THE_WAY"
  | "DELIVERED"
  | "CANCELLED";

export type CourierDeliveryStatus = "PICKED_UP" | "ON_THE_WAY" | "DELIVERED";

export const ACTIVE_DELIVERY_STATUSES = ["ASSIGNED", "PICKED_UP", "ON_THE_WAY"] as const;

export type OrderItemSnapshot = {
  productId: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
};

export type BusinessOrder = {
  id: string;
  orderGroupId: string;
  businessId: string;
  status: BusinessOrderStatus;
  items: OrderItemSnapshot[];
  subtotalCents: number;
  businessLatitude?: number | null;
  businessLongitude?: number | null;
  businessAddress?: string | null;
  paymentStatus?: "UNPAID" | "PAID" | "REFUNDED";
  paidAt?: string | Date | null;
};

export type OrderGroup = {
  id: string;
  customerId: string;
  deliveryAddress: string;
  status: OrderGroupStatus;
  businessOrders: BusinessOrder[];
  totalCents: number;
  createdAt: string | Date;
  customerName?: string;
  customerPhone?: string;
  courierId?: string | null;
  items?: OrderItemSnapshot[];
  paymentStatus?: "UNPAID" | "PAID" | "REFUNDED";
  paidAt?: string | Date | null;
};

export type CreateOrderItemPayload = {
  productId: string;
  quantity: number;
};

export type CreateOrderPayload = {
  deliveryAddress: string;
  items: CreateOrderItemPayload[];
  latitude?: number;
  longitude?: number;
};

export type UpdateBusinessOrderStatusPayload = {
  status: Extract<BusinessOrderStatus, "ACCEPTED" | "PREPARING" | "READY" | "REJECTED">;
};

export type UpdateCourierDeliveryStatusPayload = {
  status: CourierDeliveryStatus;
};

export type DeliveryLocation = {
  customer: { latitude: number; longitude: number } | null;
  courier: { latitude: number; longitude: number } | null;
};
