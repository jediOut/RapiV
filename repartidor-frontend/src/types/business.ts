export type OrderItem = {
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
  status: string;
  items?: OrderItem[];
  subtotalCents: number;
  businessLatitude?: number | null;
  businessLongitude?: number | null;
  businessAddress?: string | null;
};

export type Order = {
  id: string;
  customerId: string;
  deliveryAddress: string;
  createdAt: string;
  status: string;
  businessOrders?: BusinessOrder[];
  subtotalCents?: number;
  deliveryFeeCents?: number;
  courierPayoutCents?: number;
  courierPayoutStatus?: "NOT_APPLICABLE" | "PENDING" | "PAID" | "FAILED" | "CANCELLED";
  courierPayoutPaidAt?: string | Date | null;
  courierPayoutProviderTransferId?: string | null;
  courierPayoutFailedAt?: string | Date | null;
  courierPayoutError?: string | null;
  platformDeliveryMarginCents?: number;
  totalCents: number;
  customerName?: string;
  customerPhone?: string;
  courierId?: string | null;
  paymentMethod?: "CARD" | "CASH";
  items?: OrderItem[];
  paymentStatus?: "UNPAID" | "PAID" | "REFUNDED";
  cashReceivedCents?: number | null;
  cashChangeCents?: number | null;
  cashCollectedAt?: string | Date | null;
  paidAt?: string | Date | null;
  businessLatitude?: number | null;
  businessLongitude?: number | null;
  businessAddress?: string | null;
};
