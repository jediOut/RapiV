import type {
  BusinessOrder,
  Business,
  Product,
  OrderGroupStatus
} from "@rapidin/contracts";

export type { Business, BusinessOrder, Product };

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Order {
  id: string;
  status:
    | 'pending'
    | 'confirmed'
    | 'preparing'
    | 'ready'
    | 'assigned'
    | 'picked_up'
    | 'on_the_way'
    | 'delivered'
    | 'cancelled';
  totalPrice: number;
  subtotalCents?: number;
  deliveryFeeCents?: number;
  deliveryAddress: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  sourceStatus?: OrderGroupStatus;
  businessOrders?: BusinessOrder[];
  courierId?: string | null;
  paymentMethod?: 'CARD' | 'CASH';
  fulfillmentMethod?: 'DELIVERY' | 'PICKUP';
  paymentStatus?: 'UNPAID' | 'PAID' | 'REFUNDED';
  cashReceivedCents?: number | null;
  cashChangeCents?: number | null;
  cashCollectedAt?: string | null;
  paidAt?: string | null;
}

export interface OrderItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
}
