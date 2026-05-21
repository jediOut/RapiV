import apiClient from './apiClient';
import { API_ENDPOINTS } from '../config/api';
import type { Order } from '../types/business';
import type { CreateOrderPayload, OrderGroup } from '@rapidin/contracts';

export type Coordinates = {
  latitude: number;
  longitude: number;
};

function normalizeOrder(orderGroup: OrderGroup): Order {
  const items = orderGroup.businessOrders.flatMap((businessOrder) =>
    businessOrder.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      price: item.unitPriceCents / 100,
      quantity: item.quantity
    }))
  );

  const statusMap: Record<string, Order['status']> = {
    PENDING_BUSINESS: 'pending',
    ACCEPTED_BY_BUSINESS: 'confirmed',
    PARTIALLY_ACCEPTED: 'confirmed',
    PREPARING: 'preparing',
    READY_FOR_PICKUP: 'ready',
    ASSIGNED: 'assigned',
    PICKED_UP: 'picked_up',
    ON_THE_WAY: 'on_the_way',
    DELIVERED: 'delivered',
    REJECTED: 'cancelled',
    CANCELLED: 'cancelled'
  };

  return {
    id: orderGroup.id,
    status: statusMap[orderGroup.status] ?? 'pending',
    totalPrice: orderGroup.totalCents / 100,
    deliveryAddress: orderGroup.deliveryAddress,
    createdAt: String(orderGroup.createdAt),
    updatedAt: String(orderGroup.createdAt),
    items,
    sourceStatus: orderGroup.status,
    paymentStatus: orderGroup.paymentStatus,
    paidAt: orderGroup.paidAt ? String(orderGroup.paidAt) : null
  };
}

export const orderApi = {
  async getOrders(): Promise<Order[]> {
    const orders = await apiClient.get<OrderGroup[]>(API_ENDPOINTS.ORDERS + '/mine');
    return orders.map(normalizeOrder);
  },

  async getOrderDetail(id: string): Promise<Order> {
    const order = await apiClient.get<OrderGroup>(API_ENDPOINTS.ORDER_DETAIL(id));
    return normalizeOrder(order);
  },

  async createOrder(payload: CreateOrderPayload, idempotencyKey?: string): Promise<Order> {
    const requestKey = idempotencyKey ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const order = await apiClient.post<OrderGroup>(API_ENDPOINTS.CREATE_ORDER, payload, {
      'Idempotency-Key': requestKey
    });
    return normalizeOrder(order);
  },

  async updateCustomerLocation(orderGroupId: string, location: Coordinates): Promise<void> {
    await apiClient.patch(`/orders/${orderGroupId}/customer-location`, location);
  },

  async getDeliveryLocation(orderGroupId: string): Promise<{
    customer: Coordinates | null;
    courier: Coordinates | null;
  }> {
    return apiClient.get(`/orders/${orderGroupId}/delivery-location`);
  }
};
