import { apiRequest } from './apiClient';
import type { BusinessOrder } from '../types/business';

export async function fetchBusinessOrders(
  token: string,
  businessId: string
): Promise<BusinessOrder[]> {
  return apiRequest<BusinessOrder[]>(`/orders/businesses/${businessId}/pending`, {
    token
  });
}

export async function updateBusinessOrderStatus(
  token: string,
  businessId: string,
  orderId: string,
  status: 'ACCEPTED' | 'PREPARING' | 'READY' | 'REJECTED' | 'DELIVERED'
): Promise<BusinessOrder> {
  return apiRequest<BusinessOrder>(
    `/orders/businesses/${businessId}/suborders/${orderId}/status`,
    {
      method: 'PATCH',
      token,
      body: { status }
    }
  );
}

export async function confirmBusinessCashPayout(
  token: string,
  businessId: string,
  orderId: string
): Promise<BusinessOrder> {
  return apiRequest<BusinessOrder>(
    `/orders/businesses/${businessId}/suborders/${orderId}/cash-payout/confirm`,
    {
      method: 'PATCH',
      token
    }
  );
}
