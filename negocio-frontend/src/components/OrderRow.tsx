import { StyleSheet, Text, View, TouchableOpacity } from "react-native";

import { colors } from "../theme/colors";
import type { BusinessOrder } from "../types/business";

type OrderRowProps = {
  order: BusinessOrder;
  compact?: boolean;
  onUpdateStatus?: (order: BusinessOrder, nextStatus: 'ACCEPTED' | 'PREPARING' | 'READY' | 'REJECTED') => void;
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

const getPaymentLabel = (paymentStatus?: string) => {
  if (paymentStatus === 'PAID') {
    return 'Pagado';
  }

  if (paymentStatus === 'REFUNDED') {
    return 'Reembolsado';
  }

  return 'Pendiente de pago';
};

const getActionLabel = (status: BusinessOrder['status']) => {
  switch (status) {
    case 'PENDING':
      return 'Aceptar';
    case 'ACCEPTED':
      return 'Preparar';
    case 'PREPARING':
      return 'Listo';
    default:
      return '';
  }
};

export function OrderRow({ order, compact = false, onUpdateStatus }: OrderRowProps) {
  const statusStyle = getStatusStyle(order.status);
  const actionLabel = getActionLabel(order.status);
  const total = (order.subtotalCents / 100).toFixed(2);

  return (
    <View style={styles.orderRow}>
      <View style={styles.orderTopLine}>
        <View>
          <Text style={styles.itemTitle}>{order.id.slice(0, 8)}</Text>
          <Text style={styles.mutedText}>Items: {order.items.length}</Text>
        </View>
        <View style={[styles.orderStatus, statusStyle]}>
          <Text style={styles.orderStatusText}>{getStatusLabel(order.status)}</Text>
        </View>
      </View>
      <Text style={styles.paymentStatus}>
        {getPaymentLabel(order.paymentStatus)}
      </Text>
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
                onPress={() => onUpdateStatus(order, 'REJECTED')}
                style={[styles.actionButton, styles.rejectButton]}
              >
                <Text style={styles.rejectText}>Rechazar</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={() => onUpdateStatus(order, order.status === 'PENDING' ? 'ACCEPTED' : order.status === 'ACCEPTED' ? 'PREPARING' : 'READY')}
              style={styles.actionButton}
            >
              <Text style={styles.actionText}>{actionLabel}</Text>
            </TouchableOpacity>
          </View>
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
  itemTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0
  },
  mutedText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18
  },
  orderStatus: {
    borderRadius: 999,
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
    fontWeight: "800"
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
  }
});
