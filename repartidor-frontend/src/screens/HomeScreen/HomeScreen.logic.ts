import type { Order } from '../../types/business';

export type Coordinates = { latitude: number; longitude: number };

export const ACTIVE_PARTIAL_DELIVERY_STATUSES = [
  'ASSIGNED',
  'PARTIALLY_PICKED_UP',
  'PICKED_UP',
  'ON_THE_WAY',
] as const;

export const TERMINAL_DELIVERY_STATUSES = [
  'DELIVERED',
  'REJECTED',
  'CANCELLED',
  'FAILED',
] as const;

export const STATUS_LABELS: Record<string, string> = {
  ASSIGNED: 'Asignado',
  PICKED_UP: 'Recogido',
  PARTIALLY_PICKED_UP: 'Recogida parcial',
  ON_THE_WAY: 'En camino',
  DELIVERED: 'Entregado',
  REJECTED: 'Rechazado',
  CANCELLED: 'Cancelado',
  PENDING: 'Pendiente',
  FAILED: 'Fallido',
  READY_FOR_PICKUP: 'Listo para recoger',
  PARTIALLY_READY: 'Parcialmente listo',
  PREPARING: 'En preparación',
  READY: 'Listo',
};

export function formatStatus(status: string) {
  return STATUS_LABELS[status] ?? status;
}

export function isTerminalDeliveryStatus(status: string) {
  return TERMINAL_DELIVERY_STATUSES.includes(status as typeof TERMINAL_DELIVERY_STATUSES[number]);
}

export function getNextDeliveryStatus(order: Order): 'PICKED_UP' | 'ON_THE_WAY' | 'DELIVERED' {
  const businessStatuses = order.businessOrders?.map((businessOrder) => businessOrder.status) ?? [];
  const hasCollectableOrder = businessStatuses.some((status) => status === 'ASSIGNED' || status === 'READY');
  const allPickedUp = businessStatuses.length > 0 && businessStatuses.every((status) => status === 'PICKED_UP');

  if (hasCollectableOrder) {
    return 'PICKED_UP';
  }

  if (allPickedUp || order.status === 'PICKED_UP') {
    return 'ON_THE_WAY';
  }

  return 'DELIVERED';
}

export function getBusinessOrderPoint(
  businessOrder: NonNullable<Order['businessOrders']>[number]
): Coordinates | undefined {
  if (
    businessOrder.businessLatitude === null ||
    businessOrder.businessLatitude === undefined ||
    businessOrder.businessLongitude === null ||
    businessOrder.businessLongitude === undefined
  ) {
    return undefined;
  }

  return {
    latitude: Number(businessOrder.businessLatitude),
    longitude: Number(businessOrder.businessLongitude),
  };
}

export function getPickupPoint(order: Order): Coordinates | undefined {
  const businessOrder = order.businessOrders?.find(
    (current) =>
      ['ASSIGNED', 'READY'].includes(current.status) &&
      getBusinessOrderPoint(current)
  ) ?? order.businessOrders?.find((current) => getBusinessOrderPoint(current));

  return businessOrder ? getBusinessOrderPoint(businessOrder) : undefined;
}

export function getPickupAddress(order: Order) {
  return (
    order.businessOrders?.find((current) => ['ASSIGNED', 'READY'].includes(current.status) && current.businessAddress)?.businessAddress
    ?? order.businessOrders?.find((current) => current.businessAddress)?.businessAddress
    ?? 'Dirección del negocio no disponible'
  );
}

export function getRouteDestination(
  order: Order,
  pickupLocation?: Coordinates,
  customerLocation?: Coordinates
) {
  if (order.status === 'ASSIGNED' || order.status === 'PARTIALLY_PICKED_UP') {
    return pickupLocation;
  }

  if (order.status === 'PICKED_UP' || order.status === 'ON_THE_WAY') {
    return customerLocation;
  }

  return undefined;
}

export function getRouteButtonLabel(order: Order) {
  if (
    order.businessOrders &&
    order.businessOrders.length > 1 &&
    (order.status === 'ASSIGNED' || order.status === 'PARTIALLY_PICKED_UP')
  ) {
    return 'Abrir ruta al siguiente comercio';
  }

  if (order.status === 'ASSIGNED') {
    return 'Abrir ruta al comercio';
  }

  if (order.status === 'PICKED_UP' || order.status === 'ON_THE_WAY') {
    return 'Abrir ruta al cliente';
  }

  return 'Abrir ruta sugerida';
}

export function getOrderFlowCopy(order: Order) {
  const businessOrders = order.businessOrders ?? [];

  if (businessOrders.length <= 1) {
    return {
      title: 'Pedido de un comercio',
      body: 'Flujo normal: recoge en el comercio indicado y después avanza a la entrega.',
    };
  }

  const readyCount = businessOrders.filter((businessOrder) =>
    ['ASSIGNED', 'READY', 'PICKED_UP'].includes(businessOrder.status)
  ).length;
  const pickedUpCount = businessOrders.filter((businessOrder) => businessOrder.status === 'PICKED_UP').length;

  return {
    title: `Multipedido: ${businessOrders.length} comercios`,
    body: `Puedes elegir tu camino y recoger en el orden que prefieras. Hay ${readyCount} de ${businessOrders.length} comercios listos o recogidos; debes recogerlos todos (${pickedUpCount}/${businessOrders.length}) antes de salir a entregar.`,
  };
}
