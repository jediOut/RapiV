import { Alert, StyleSheet, Text, View, TouchableOpacity } from "react-native";

import { colors } from "../theme/colors";
import type { BusinessOrder } from "../types/business";

type OrderRowProps = {
  order: BusinessOrder;
  compact?: boolean;
  onConfirmCashPayout?: (order: BusinessOrder) => void;
  onUpdateStatus?: (order: BusinessOrder, nextStatus: 'ACCEPTED' | 'PREPARING' | 'READY' | 'REJECTED' | 'DELIVERED') => void;
};

const getStatusStyle = (status: BusinessOrder['status']) => {
  switch (status) {
    case 'PENDING':
      return styles.statusNew;
    case 'ACCEPTED':
    case 'PREPARING':
      return styles.statusPreparing;
    case 'READY':
      return styles.statusReady;
    case 'ASSIGNED':
    case 'PICKED_UP':
    case 'ON_THE_WAY':
      return styles.statusReady;
    case 'REJECTED':
    case 'CANCELLED':
      return styles.statusCancelled;
    case 'DELIVERED':
      return styles.statusCompleted;
    default:
      return styles.statusNew;
  }
};

const getStatusLabel = (status: BusinessOrder['status']) => {
  switch (status) {
    case 'PENDING':
      return 'Pendiente';
    case 'ACCEPTED':
      return 'Aceptado';
    case 'PREPARING':
      return 'Preparando';
    case 'READY':
      return 'Listo';
    case 'ASSIGNED':
      return 'Asignado';
    case 'PICKED_UP':
      return 'Recogido';
    case 'ON_THE_WAY':
      return 'En camino';
    case 'DELIVERED':
      return 'Entregado';
    case 'REJECTED':
      return 'Rechazado';
    case 'CANCELLED':
      return 'Cancelado';
    default:
      return status;
  }
};

const getPaymentLabel = (paymentMethod?: string, paymentStatus?: string) => {
  if (paymentMethod === 'CASH') {
    return 'Efectivo';
  }

  if (paymentStatus === 'PAID') {
    return 'Tarjeta pagada';
  }

  if (paymentStatus === 'REFUNDED') {
    return 'Tarjeta reembolsada';
  }

  return 'Tarjeta pendiente de pago';
};

const getFulfillmentLabel = (fulfillmentMethod?: BusinessOrder['fulfillmentMethod']) =>
  fulfillmentMethod === 'PICKUP' ? 'Recoge cliente' : 'Con envío';

const getCashPayoutLabel = (
  status: BusinessOrder['businessCashPayoutStatus'] | undefined,
  fulfillmentMethod?: BusinessOrder['fulfillmentMethod']
) => {
  if (fulfillmentMethod !== 'PICKUP') {
    return null;
  }

  switch (status) {
    case 'PENDING':
      return 'Pago del cliente pendiente';
    case 'CONFIRMED':
      return 'Pago del cliente confirmado';
    case 'CANCELLED':
      return 'Pago del cliente cancelado';
    default:
      return null;
  }
};

const formatOrderDate = (value?: string | Date) => {
  if (!value) {
    return 'Fecha no disponible';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Fecha no disponible';
  }

  return date.toLocaleString('es-MX', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const getOrderNote = (order: BusinessOrder) => {
  if (order.status === 'DELIVERED') {
    return 'Pedido entregado al cliente.';
  }

  if (order.status === 'REJECTED') {
    return order.paymentStatus === 'REFUNDED'
      ? 'Rechazaste este pedido. El pago fue reembolsado.'
      : 'Rechazaste este pedido.';
  }

  if (order.status === 'CANCELLED') {
    return order.paymentStatus === 'REFUNDED'
      ? 'Multipedido cancelado. El cliente recibió reembolso.'
      : 'Pedido cancelado antes de completarse.';
  }

  if (order.paymentStatus === 'REFUNDED') {
    return 'Pago reembolsado.';
  }

  return null;
};

const getActionLabel = (status: BusinessOrder['status']) => {
  switch (status) {
    case 'PENDING':
      return 'Aceptar pedido';
    case 'ACCEPTED':
      return 'Empezar preparación';
    case 'PREPARING':
      return 'Marcar listo';
    case 'READY':
      return 'Marcar entregado';
    default:
      return '';
  }
};

export function OrderRow({ order, compact = false, onConfirmCashPayout, onUpdateStatus }: OrderRowProps) {
  const statusStyle = getStatusStyle(order.status);
  const actionLabel = order.status === 'READY' && order.fulfillmentMethod !== 'PICKUP'
    ? ''
    : getActionLabel(order.status);
  const total = (order.subtotalCents / 100).toFixed(2);
  const commission = ((order.businessCommissionCents ?? 0) / 100).toFixed(2);
  const payout = ((order.businessPayoutCents ?? order.subtotalCents) / 100).toFixed(2);
  const isCashDelivery = order.paymentMethod === 'CASH' && order.fulfillmentMethod !== 'PICKUP';
  const canProcessOrder = order.paymentMethod === 'CASH' || order.paymentStatus === 'PAID';
  const canConfirmCashPayout =
    order.paymentMethod === 'CASH' &&
    (order.status === 'DELIVERED' || (order.fulfillmentMethod === 'PICKUP' && order.status === 'READY')) &&
    order.businessCashPayoutStatus === 'PENDING' &&
    Boolean(onConfirmCashPayout);
  const cashPayoutLabel = getCashPayoutLabel(order.businessCashPayoutStatus, order.fulfillmentMethod);
  const orderNote = getOrderNote(order);
  const requestCashPayoutConfirmation = () => {
    if (!onConfirmCashPayout) {
      return;
    }

    Alert.alert(
      'Confirmar dinero recibido',
      `Confirma que el cliente ya te entregó $${payout} de este pedido.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: () => onConfirmCashPayout(order)
        }
      ]
    );
  };
  const requestStatusChange = (nextStatus: 'ACCEPTED' | 'PREPARING' | 'READY' | 'REJECTED' | 'DELIVERED') => {
    if (!onUpdateStatus) {
      return;
    }

    if (nextStatus === 'ACCEPTED' || nextStatus === 'REJECTED') {
      const isRejecting = nextStatus === 'REJECTED';
      Alert.alert(
        isRejecting ? 'Rechazar pedido' : 'Aceptar pedido',
        isRejecting
          ? 'Confirma que quieres rechazar este pedido. El cliente verá que el negocio no pudo aceptarlo.'
          : 'Confirma que quieres aceptar este pedido y comenzar a prepararlo.',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: isRejecting ? 'Rechazar' : 'Aceptar',
            style: isRejecting ? 'destructive' : 'default',
            onPress: () => onUpdateStatus(order, nextStatus)
          }
        ]
      );
      return;
    }

    onUpdateStatus(order, nextStatus);
  };
  const orderNumber = `RAP-${order.id.slice(0, 8).toUpperCase()}`;

  return (
    <View style={styles.orderRow}>
      <View style={styles.orderTopLine}>
        <View style={styles.orderTitleBlock}>
          <Text style={styles.itemTitle}>Número de pedido {orderNumber}</Text>
          <Text style={styles.dateText}>{formatOrderDate(order.createdAt)}</Text>
          <Text style={styles.mutedText}>Items: {order.items.length}</Text>
        </View>
        <View style={[styles.orderStatus, statusStyle]}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={styles.orderStatusText}>
            {getStatusLabel(order.status)}
          </Text>
        </View>
      </View>
      <Text style={styles.paymentStatus}>
        {getPaymentLabel(order.paymentMethod, order.paymentStatus)} - {getFulfillmentLabel(order.fulfillmentMethod)}
      </Text>
      <View style={styles.financialPanel}>
        <View style={styles.financialMetric}>
          <Text style={styles.financialLabel}>Venta</Text>
          <Text style={styles.financialValue}>${total}</Text>
        </View>
        {isCashDelivery ? null : (
          <View style={styles.financialMetric}>
            <Text style={styles.financialLabel}>Comisión RapiV</Text>
            <Text style={styles.financialValueMuted}>-${commission}</Text>
          </View>
        )}
        <View style={styles.financialMetric}>
          <Text style={styles.financialLabel}>{isCashDelivery ? 'Liquidación RapiV' : 'Recibirás'}</Text>
          <Text style={styles.financialValuePrimary}>${payout}</Text>
        </View>
      </View>
      <Text style={styles.financialNote}>
        {isCashDelivery
          ? 'En entregas con efectivo, RapiV cobra al repartidor desde su depósito y liquida al negocio sin confirmación manual.'
          : 'El envío y el pago al repartidor se liquidan aparte de la venta del negocio.'}
      </Text>
      {cashPayoutLabel ? (
        <View style={[
          styles.cashPayoutBadge,
          order.businessCashPayoutStatus === 'CONFIRMED' && styles.cashPayoutConfirmed,
          order.businessCashPayoutStatus === 'PENDING' && styles.cashPayoutPending
        ]}>
          <Text style={styles.cashPayoutText}>{cashPayoutLabel}</Text>
        </View>
      ) : null}
      {!canProcessOrder && order.status === 'PENDING' ? (
        <Text style={styles.paymentHint}>Aparece en la lista, pero no se puede preparar hasta que Stripe confirme el pago.</Text>
      ) : null}
      {orderNote ? (
        <Text style={styles.orderNote}>{orderNote}</Text>
      ) : null}
      {!compact && (
        <Text style={styles.orderItems} numberOfLines={2}>
          {order.items.map((item) => `${item.quantity}× ${item.productName}`).join(', ')}
        </Text>
      )}
      <View style={styles.orderFooter}>
        <Text style={styles.orderTotal}>${total}</Text>
        {actionLabel && onUpdateStatus ? (
          <View style={styles.actions}>
            {order.status === 'PENDING' ? (
              <TouchableOpacity
                onPress={() => requestStatusChange('REJECTED')}
                style={[styles.actionButton, styles.rejectButton]}
              >
                <Text style={styles.rejectText}>Rechazar</Text>
              </TouchableOpacity>
            ) : null}
            {canConfirmCashPayout && order.fulfillmentMethod === 'PICKUP' ? (
              <TouchableOpacity
                onPress={requestCashPayoutConfirmation}
                style={styles.actionButton}
              >
                <Text style={styles.actionText}>Confirmar pago</Text>
              </TouchableOpacity>
            ) : canProcessOrder ? (
              <TouchableOpacity
                onPress={() => requestStatusChange(order.status === 'PENDING' ? 'ACCEPTED' : order.status === 'ACCEPTED' ? 'PREPARING' : order.status === 'READY' ? 'DELIVERED' : 'READY')}
                style={styles.actionButton}
              >
                <Text style={styles.actionText}>{actionLabel}</Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.actionButton, styles.disabledAction]}>
                <Text style={styles.disabledActionText}>Esperando pago</Text>
              </View>
            )}
          </View>
        ) : canConfirmCashPayout ? (
          <TouchableOpacity
            onPress={requestCashPayoutConfirmation}
            style={styles.actionButton}
          >
            <Text style={styles.actionText}>Confirmar recibido</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  orderRow: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    padding: 14
  },
  orderTopLine: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between"
  },
  orderTitleBlock: {
    flex: 1,
    minWidth: 0
  },
  itemTitle: {
    color: colors.text,
    flexShrink: 1,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: 20
  },
  mutedText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18
  },
  dateText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 2
  },
  orderStatus: {
    alignItems: "center",
    borderRadius: 999,
    flexShrink: 0,
    justifyContent: "center",
    maxWidth: 96,
    minHeight: 28,
    minWidth: 76,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  statusNew: {
    backgroundColor: colors.info
  },
  statusPreparing: {
    backgroundColor: colors.warning
  },
  statusReady: {
    backgroundColor: colors.success
  },
  orderStatusText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center"
  },
  orderItems: {
    color: "#334155",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12
  },
  paymentStatus: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 8
  },
  paymentHint: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4
  },
  financialPanel: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    padding: 10
  },
  financialMetric: {
    flex: 1,
    minWidth: 0
  },
  financialLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 15
  },
  financialValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
    marginTop: 2
  },
  financialValueMuted: {
    color: "#B45309",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 2
  },
  financialValuePrimary: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "900",
    marginTop: 2
  },
  financialNote: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 6
  },
  cashPayoutBadge: {
    alignSelf: "flex-start",
    borderRadius: 8,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  cashPayoutConfirmed: {
    backgroundColor: "#DCFCE7"
  },
  cashPayoutPending: {
    backgroundColor: "#FEF3C7"
  },
  cashPayoutText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800"
  },
  orderNote: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 6
  },
  orderFooter: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12
  },
  orderTotal: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: "900"
  },
  statusCompleted: {
    backgroundColor: colors.disabled
  },
  statusCancelled: {
    backgroundColor: "#FEE2E2"
  },
  actionButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  actions: {
    flexDirection: "row",
    gap: 8
  },
  actionText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: "800"
  },
  rejectButton: {
    backgroundColor: colors.surface,
    borderColor: "#B91C1C",
    borderWidth: 1
  },
  rejectText: {
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: "800"
  },
  disabledAction: {
    backgroundColor: colors.disabled
  },
  disabledActionText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800"
  }
});
