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
      return colors.warning;
    case 'confirmed':
      return colors.warning;
    case 'preparing':
      return colors.warning;
    case 'ready':
      return colors.secondary;
    case 'assigned':
    case 'picked_up':
    case 'on_the_way':
      return colors.primary;
    case 'delivered':
      return colors.success;
    case 'cancelled':
      return colors.danger;
    default:
      return colors.textSecondary;
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

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        <Text style={styles.orderId}>Orden #{order.id.slice(0, 8)}</Text>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(order.status) },
          ]}
        >
          <Text style={styles.statusText}>{getStatusLabel(order.status)}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.date}>{createdDate}</Text>
        <Text style={styles.itemsCount}>
          {order.items.length} artículo{order.items.length > 1 ? 's' : ''}
        </Text>
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.background,
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
