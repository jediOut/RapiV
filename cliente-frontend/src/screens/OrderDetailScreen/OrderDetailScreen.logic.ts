import { colors } from '../../theme/colors';
import { Payment } from '../../services/paymentApi';
import { Order } from '../../types/business';

export function getStatusColor(status: Order['status']) {
  switch (status) {
    case 'pending':
    case 'confirmed':
    case 'preparing':
      return '#FFFBEB';
    case 'ready':
      return '#EFF6FF';
    case 'assigned':
    case 'picked_up':
    case 'on_the_way':
      return '#E0F2FE';
    case 'delivered':
      return '#ECFDF5';
    case 'cancelled':
      return '#FEF2F2';
    default:
      return '#F1F5F9';
  }
}

export function getStatusTextColor(status: Order['status']) {
  switch (status) {
    case 'pending':
    case 'confirmed':
    case 'preparing':
      return '#92400E';
    case 'ready':
      return '#1D4ED8';
    case 'assigned':
    case 'picked_up':
    case 'on_the_way':
      return '#0369A1';
    case 'delivered':
      return '#047857';
    case 'cancelled':
      return '#B91C1C';
    default:
      return colors.text;
  }
}

export function getStatusLabel(status: Order['status']) {
  const labels: Record<Order['status'], string> = {
    pending: 'Pendiente',
    confirmed: 'Confirmado',
    preparing: 'Preparando',
    ready: 'Listo',
    assigned: 'Repartidor asignado',
    picked_up: 'Recogido',
    on_the_way: 'En camino',
    delivered: 'Entregado',
    cancelled: 'Cancelado',
  };

  return labels[status];
}

export function orderPaymentLabel(order: Order): string {
  if (order.status === 'cancelled' && order.paymentMethod === 'CARD') {
    return order.paymentStatus === 'REFUNDED' ? 'Reembolsado' : 'Cancelado';
  }

  if (order.paymentMethod === 'CASH') {
    return 'Pago en efectivo';
  }

  if (order.paymentStatus === 'PAID') {
    return 'Pagado';
  }

  if (order.paymentStatus === 'REFUNDED') {
    return 'Reembolsado';
  }

  return 'Pendiente de pago';
}

export function paymentLabel(status: Payment['status']): string {
  const labels: Record<Payment['status'], string> = {
    REQUIRES_ACTION: 'esperando pago',
    PROCESSING: 'procesando',
    SUCCEEDED: 'aprobado',
    FAILED: 'rechazado',
    CANCELLED: 'cancelado',
  };

  return labels[status];
}

export function distanceInKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
): number {
  const earthRadiusKm = 6371;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}
