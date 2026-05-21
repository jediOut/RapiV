import type {
  Business,
  Product,
  OrderGroupStatus
} from "@rapidin/contracts";

export type { Business, Product };

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
  deliveryAddress: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  sourceStatus?: OrderGroupStatus;
  paymentStatus?: 'UNPAID' | 'PAID' | 'REFUNDED';
  paidAt?: string | null;
}

export interface OrderItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
}
