import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  SafeAreaView,
  Pressable,
  Text,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Header from '../components/Header';
import { CustomerTabBar } from '../components/CustomerTabBar';
import OrderCard from '../components/OrderCard';
import { StateView } from '../components/StateView';
import { colors } from '../theme/colors';
import { orderApi } from '../services/orderApi';
import { Order } from '../types/business';
import { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Orders'>;
type OrdersTab = 'active' | 'history';

const terminalStatuses: Array<Order['status']> = ['delivered', 'cancelled'];

export default function OrdersScreen({ navigation }: Props) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedTab, setSelectedTab] = useState<OrdersTab>('active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await orderApi.getOrders();
      setOrders(data);
    } catch (error) {
      console.error('Error loading orders:', error);
      setError(error instanceof Error ? error.message : 'No se pudieron cargar tus pedidos');
    } finally {
      setLoading(false);
    }
  };

  const handleOrderPress = (orderId: string) => {
    navigation.navigate('OrderDetail', { orderId });
  };

  const activeOrders = orders.filter((order) => !terminalStatuses.includes(order.status));
  const historyOrders = orders.filter((order) => terminalStatuses.includes(order.status));
  const visibleOrders = selectedTab === 'active' ? activeOrders : historyOrders;

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Mis Pedidos"
        onBackPress={() => navigation.goBack()}
      />

      {loading ? (
        <StateView title="Cargando pedidos" message="Estamos actualizando tu historial." type="loading" />
      ) : error ? (
        <StateView
          actionLabel="Reintentar"
          message={error}
          onAction={loadOrders}
          title={error.includes('Sin conexion') ? 'Sin conexion' : 'No pudimos cargar tus pedidos'}
          type="error"
        />
      ) : (
        <View style={styles.content}>
          <View style={styles.tabs}>
            <OrdersTabButton
              count={activeOrders.length}
              isSelected={selectedTab === 'active'}
              label="Activos"
              onPress={() => setSelectedTab('active')}
            />
            <OrdersTabButton
              count={historyOrders.length}
              isSelected={selectedTab === 'history'}
              label="Historial"
              onPress={() => setSelectedTab('history')}
            />
          </View>

          <FlatList
            data={visibleOrders}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <StateView
                message={
                  selectedTab === 'active'
                    ? 'Cuando tengas un pedido en curso, lo veras aqui con su estado.'
                    : 'Los pedidos entregados o cancelados apareceran aqui.'
                }
                title={selectedTab === 'active' ? 'No tienes pedidos activos' : 'No hay compras anteriores'}
              />
            }
            renderItem={({ item }) => (
              <OrderCard
                order={item}
                onPress={() => handleOrderPress(item.id)}
              />
            )}
            contentContainerStyle={styles.listContent}
          />
        </View>
      )}
      <CustomerTabBar active="orders" navigation={navigation} />
    </SafeAreaView>
  );
}

function OrdersTabButton({
  count,
  isSelected,
  label,
  onPress,
}: {
  count: number;
  isSelected: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tabButton, isSelected && styles.selectedTabButton]}
    >
      <Text style={[styles.tabText, isSelected && styles.selectedTabText]}>
        {label}
      </Text>
      <View style={[styles.countBadge, isSelected && styles.selectedCountBadge]}>
        <Text style={[styles.countText, isSelected && styles.selectedCountText]}>
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  tabButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  selectedTabButton: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  tabText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  selectedTabText: {
    color: colors.primary,
  },
  countBadge: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 999,
    minWidth: 24,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  selectedCountBadge: {
    backgroundColor: colors.primary,
  },
  countText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  selectedCountText: {
    color: colors.surface,
  },
  listContent: {
    flexGrow: 1,
    padding: 16,
  },
});
