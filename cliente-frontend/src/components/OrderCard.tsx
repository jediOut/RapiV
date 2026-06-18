import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { Order } from '../types/business';

interface OrderCardProps {
  order: Order;
  onPress: () => void;
}

const getStatusColor = (status: Order['status']) => {
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
};

const getStatusTextColor = (status: Order['status']) => {
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
};

const getStatusLabel = (status: Order['status']) => {
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
};

export default function OrderCard({ order, onPress }: OrderCardProps) {
  const createdDate = new Date(order.createdAt).toLocaleDateString('es-ES');
  const orderNumber = `RAP-${order.id.slice(0, 8).toUpperCase()}`;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        <Text style={styles.orderId}>Número de pedido {orderNumber}</Text>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(order.status) },
          ]}
        >
          <Text style={[styles.statusText, { color: getStatusTextColor(order.status) }]}>
            {getStatusLabel(order.status)}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.date}>{createdDate}</Text>
        <Text style={styles.itemsCount}>
          {order.items.length} artículo{order.items.length > 1 ? 's' : ''}
        </Text>
        {order.paymentStatus === 'REFUNDED' ? (
          <Text style={styles.refundText}>Pago reembolsado</Text>
        ) : null}
      </View>

      <View style={styles.footer}>
        <Text style={styles.price}>${order.totalPrice.toFixed(2)}</Text>
        <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderId: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  statusBadge: {
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  body: {
    marginBottom: 8,
  },
  date: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  itemsCount: {
    fontSize: 13,
    color: colors.text,
  },
  refundText: {
    color: colors.dangerText,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
});
