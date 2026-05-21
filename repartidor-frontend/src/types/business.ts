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
  totalCents: number;
  customerName?: string;
  customerPhone?: string;
  courierId?: string | null;
  items?: OrderItem[];
  paymentStatus?: "UNPAID" | "PAID" | "REFUNDED";
  paidAt?: string | Date | null;
  businessLatitude?: number | null;
  businessLongitude?: number | null;
  businessAddress?: string | null;
};
