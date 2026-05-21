import { apiRequest } from './apiClient';
import type { Order } from '../types/business';

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type DeliveryOffer = {
  id: string;
  status: string;
  score: number;
  expiresAt: string;
  order: Order;
};

export async function updateCourierAvailability(
  token: string,
  payload: {
    status: 'AVAILABLE' | 'BUSY' | 'OFFLINE';
    latitude?: number;
    longitude?: number;
    preferredRadiusKm?: number;
    maxDeliveryDistanceKm?: number;
  }
): Promise<void> {
  await apiRequest('/orders/courier/availability', {
    method: 'PATCH',
    token,
    body: payload
  });
}

export async function fetchDeliveryOffers(token: string): Promise<DeliveryOffer[]> {
  return apiRequest<DeliveryOffer[]>('/orders/courier/offers', {
    token
  });
}

export async function fetchAssignedOrders(token: string): Promise<Order[]> {
  return apiRequest<Order[]>('/orders/courier/mine', {
    token
  });
}

export async function assignOrder(token: string, orderGroupId: string): Promise<Order> {
  return apiRequest<Order>(`/orders/${orderGroupId}/assign`, {
    method: 'PATCH',
    token
  });
}

export async function acceptDeliveryOffer(token: string, offerId: string): Promise<Order> {
  return apiRequest<Order>(`/orders/courier/offers/${offerId}/accept`, {
    method: 'PATCH',
    token
  });
}

export async function updateDeliveryStatus(
  token: string,
  orderGroupId: string,
  status: 'PICKED_UP' | 'ON_THE_WAY' | 'DELIVERED'
): Promise<Order> {
  return apiRequest<Order>(`/orders/${orderGroupId}/delivery-status`, {
    method: 'PATCH',
    token,
    body: { status }
  });
}

export async function updateCourierLocation(
  token: string,
  orderGroupId: string,
  location: Coordinates
): Promise<void> {
  await apiRequest(`/orders/${orderGroupId}/courier-location`, {
    method: 'PATCH',
    token,
    body: location
  });
}

export async function fetchDeliveryLocation(
  token: string,
  orderGroupId: string
): Promise<{ customer: Coordinates | null; courier: Coordinates | null }> {
  return apiRequest(`/orders/${orderGroupId}/delivery-location`, {
    token
  });
}
