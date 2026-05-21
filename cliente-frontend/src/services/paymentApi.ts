import apiClient from './apiClient';

export type PaymentStatus =
  | 'REQUIRES_ACTION'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED';

export type Payment = {
  id: string;
  orderGroupId: string;
  amountCents: number;
  currency: string;
  status: PaymentStatus;
  provider: string;
  providerPaymentId: string;
  checkoutUrl?: string;
  clientSecret?: string;
};

export const paymentApi = {
  createPayment(orderGroupId: string, idempotencyKey: string): Promise<Payment> {
    return apiClient.post<Payment>(
      '/payments',
      { orderGroupId },
      { 'Idempotency-Key': idempotencyKey }
    );
  },

  getOrderPayments(orderGroupId: string): Promise<Payment[]> {
    return apiClient.get<Payment[]>(`/payments/orders/${orderGroupId}`);
  },

  syncPayment(paymentId: string): Promise<Payment> {
    return apiClient.post<Payment>(`/payments/${paymentId}/sync`, {});
  },
};
