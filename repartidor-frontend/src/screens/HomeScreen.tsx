import React, { useEffect, useState } from 'react';
import {
  FlatList,
  Linking,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline } from 'react-native-maps';

import {
  acceptDeliveryOffer,
  type DeliveryOffer,
  fetchAssignedOrders,
  fetchDeliveryOffers,
  fetchDeliveryLocation,
  updateDeliveryStatus,
  updateCourierLocation,
  updateCourierAvailability,
} from '../services/orderApi';
import { sessionStorage } from '../services/sessionStorage';
import { Order } from '../types/business';
import { colors } from '../theme/colors';
import { VEGA_SERVICE_address } from '../config/serviceZone';
import { StateView } from '../components/StateView';

type ListedOrder = Order & {
  listMode: 'assigned' | 'offer';
  offerId?: string;
  offerScore?: number;
};

const ACTIVE_DELIVERY_STATUSES = ['ASSIGNED', 'PICKED_UP', 'ON_THE_WAY'] as const;

const HomeScreen: React.FC = () => {
  const [deliveryOffers, setDeliveryOffers] = useState<DeliveryOffer[]>([]);
  const [assignedOrders, setAssignedOrders] = useState<Order[]>([]);
  const [deliveryLocations, setDeliveryLocations] = useState<
    Record<string, { customer: { latitude: number; longitude: number } | null; courier: { latitude: number; longitude: number } | null }>
  >({});
  const [loading, setLoading] = useState(true);
  const [mutatingOrderId, setMutatingOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function getToken() {
    const session = await sessionStorage.loadSession();
    return session?.accessToken;
  }

  async function loadOrders() {
    setLoading(true);
    setError(null);

    try {
      const token = await getToken();

      if (!token) {
        setError('Tu sesion expiro. Inicia sesion nuevamente.');
        return;
      }

      await updateCourierAvailability(token, { status: 'AVAILABLE' });

      const [offers, assigned] = await Promise.all([
        fetchDeliveryOffers(token),
        fetchAssignedOrders(token),
      ]);

      setDeliveryOffers(offers);
      setAssignedOrders(assigned.filter((order) => order.status !== 'DELIVERED'));
      const active = assigned.filter((order) =>
        ACTIVE_DELIVERY_STATUSES.includes(order.status as typeof ACTIVE_DELIVERY_STATUSES[number])
      );
      const locations = await Promise.all(
        active.map(async (order) => [order.id, await fetchDeliveryLocation(token, order.id)] as const)
      );
      setDeliveryLocations(Object.fromEntries(locations));
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'No se pudo cargar los pedidos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOrders();
  }, []);

  useEffect(() => {
    const activeOrder = assignedOrders.find((order) =>
      ACTIVE_DELIVERY_STATUSES.includes(order.status as typeof ACTIVE_DELIVERY_STATUSES[number])
    );

    if (!activeOrder) {
      return;
    }

    const activeOrderId = activeOrder.id;
    let subscription: Location.LocationSubscription | null = null;

    async function startTracking() {
      const token = await getToken();
      if (!token) {
        return;
      }

      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setError('Permite la ubicacion para compartirla con el cliente durante la entrega');
        return;
      }

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 20,
          timeInterval: 8000,
        },
        (position) => {
          void updateCourierLocation(token, activeOrderId, {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }).then(async () => {
            const nextLocation = await fetchDeliveryLocation(token, activeOrderId);
            setDeliveryLocations((current) => ({
              ...current,
              [activeOrderId]: nextLocation,
            }));
          });
        }
      );
    }

    void startTracking();

    return () => {
      subscription?.remove();
    };
  }, [assignedOrders]);

  async function mutateOrder(orderId: string, mutation: (token: string) => Promise<void>) {
    setMutatingOrderId(orderId);
    setError(null);

    try {
      const token = await getToken();

      if (!token) {
        setError('Necesitas iniciar sesion para actualizar pedidos');
        return;
      }

      await mutation(token);
      await loadOrders();
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'No se pudo actualizar el pedido');
    } finally {
      setMutatingOrderId(null);
    }
  }

  async function handleAcceptOffer(orderId: string, offerId: string) {
    await mutateOrder(orderId, async (token) => {
      await acceptDeliveryOffer(token, offerId);
    });
  }

  async function handleAdvance(order: Order) {
    const nextStatus =
      order.status === 'ASSIGNED'
        ? 'PICKED_UP'
        : order.status === 'PICKED_UP'
          ? 'ON_THE_WAY'
          : 'DELIVERED';

    await mutateOrder(order.id, async (token) => {
      await updateDeliveryStatus(token, order.id, nextStatus);
    });
  }

  async function openSuggestedRoute(destination: { latitude: number; longitude: number }) {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}&travelmode=driving`;
    await Linking.openURL(url);
  }

  async function callCustomer(phone: string) {
    await Linking.openURL(`tel:${phone}`);
  }

  function renderOrder(item: ListedOrder) {
    const orderItems = item.items ?? item.businessOrders?.flatMap((order) => order.items ?? []) ?? [];
    const location = deliveryLocations[item.id];
    const customerLocation = location?.customer ?? undefined;
    const courierLocation = location?.courier ?? undefined;
    const businessLocation =
      item.businessLatitude && item.businessLongitude
        ? {
          latitude: Number(item.businessLatitude),
          longitude: Number(item.businessLongitude),
        }
        : undefined;
    const nextLabel =
      item.status === 'ASSIGNED'
        ? 'Marcar recogido'
        : item.status === 'PICKED_UP'
          ? 'Salir a entregar'
          : item.status === 'ON_THE_WAY'
            ? 'Marcar entregado'
            : '';
    const suggestedRoute = [
      courierLocation,
      customerLocation,
    ].filter(Boolean) as Array<{ latitude: number; longitude: number }>;

    return (
      <View style={styles.card}>
        <Text style={styles.orderId}>Pedido #{item.id.slice(0, 8)}</Text>
        <Text style={styles.orderStatus}>
          {item.listMode === 'offer' ? `Oferta sugerida (${item.offerScore ?? 0})` : item.status}
        </Text>
        <Text style={styles.orderMeta}>Direccion: {item.deliveryAddress}</Text>
        {item.customerName ? <Text style={styles.orderMeta}>Cliente: {item.customerName}</Text> : null}
        {item.customerPhone ? (
          <TouchableOpacity onPress={() => callCustomer(item.customerPhone!)} style={styles.phoneButton}>
            <Text style={styles.phoneText}>Marcar: {item.customerPhone}</Text>
          </TouchableOpacity>
        ) : null}
        <Text style={styles.orderMeta}>Total: ${(item.totalCents / 100).toFixed(2)}</Text>

        <Text style={styles.sectionTitle}>Articulos</Text>
        {orderItems.length > 0 ? (
          orderItems.map((product) => (
            <Text key={`${item.id}-${product.productId}`} style={styles.orderItem}>
              {product.quantity} x {product.productName}
            </Text>
          ))
        ) : (
          <Text style={styles.orderItem}>Productos no disponibles en este momento</Text>
        )}

        {item.listMode === 'assigned' && location ? (
          <MapView
            initialRegion={VEGA_SERVICE_address}
            region={{
              latitude:
                customerLocation?.latitude ??
                courierLocation?.latitude ??
                VEGA_SERVICE_address.latitude,
              longitude:
                customerLocation?.longitude ??
                courierLocation?.longitude ??
                VEGA_SERVICE_address.longitude,
              latitudeDelta: 0.04,
              longitudeDelta: 0.04,
            }}
            style={styles.map}
          >
            {businessLocation ? (
              <Marker
                coordinate={businessLocation}
                title="Negocio"
                pinColor="orange"
              />
            ) : null}
            {customerLocation ? (
              <Marker coordinate={customerLocation} title="Cliente" />
            ) : null}
            {courierLocation ? (
              <Marker coordinate={courierLocation} title="Tu ubicacion" pinColor={colors.primary} />
            ) : null}
            {suggestedRoute.length === 2 ? (
              <Polyline coordinates={suggestedRoute} strokeColor={colors.primary} strokeWidth={4} />
            ) : null}
          </MapView>
        ) : null}

        {item.listMode === 'assigned' && customerLocation ? (
          <TouchableOpacity
            onPress={() => openSuggestedRoute(customerLocation)}
            style={styles.routeButton}
          >
            <Text style={styles.routeText}>Abrir ruta sugerida</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          disabled={mutatingOrderId === item.id}
          onPress={() =>
            item.listMode === 'offer' && item.offerId
              ? handleAcceptOffer(item.id, item.offerId)
              : handleAdvance(item)
          }
          style={[styles.actionButton, mutatingOrderId === item.id && styles.disabledButton]}
        >
          <Text style={styles.actionText}>
            {mutatingOrderId === item.id
              ? 'Actualizando...'
              : item.listMode === 'offer'
                ? 'Aceptar oferta'
                : nextLabel}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const listedOrders: ListedOrder[] = [
    ...assignedOrders.map((order) => ({ ...order, listMode: 'assigned' as const })),
    ...deliveryOffers.map((offer) => ({
      ...offer.order,
      listMode: 'offer' as const,
      offerId: offer.id,
      offerScore: offer.score,
    })),
  ];

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Entregas</Text>
      {loading ? (
        <StateView title="Cargando pedidos" message="Estamos buscando pedidos listos y asignados." type="loading" />
      ) : error ? (
        <StateView
          actionLabel="Reintentar"
          message={error}
          onAction={loadOrders}
          title={error.includes('Sin conexion') ? 'Sin conexion' : 'No pudimos cargar los pedidos'}
          type="error"
        />
      ) : listedOrders.length === 0 ? (
        <StateView
          actionLabel="Actualizar"
          message="Cuando el sistema te recomiende un pedido por zona y disponibilidad, aparecera aqui."
          onAction={loadOrders}
          title="No tienes ofertas disponibles"
        />
      ) : (
        <FlatList
          data={listedOrders}
          keyExtractor={(item) => `${item.listMode}-${item.id}`}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => renderOrder(item)}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 18,
    color: colors.text,
  },
  list: {
    paddingBottom: 24,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 14,
  },
  orderId: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
    color: colors.text,
  },
  orderStatus: {
    color: colors.primary,
    fontWeight: '700',
    marginBottom: 8,
  },
  orderMeta: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 4,
  },
  phoneButton: {
    alignSelf: 'flex-start',
    marginBottom: 4,
    paddingVertical: 4,
  },
  phoneText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  sectionTitle: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  orderItem: {
    color: colors.text,
    fontSize: 14,
    marginTop: 2,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    marginTop: 14,
    paddingVertical: 12,
  },
  routeButton: {
    alignItems: 'center',
    borderColor: colors.primary,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    paddingVertical: 11,
  },
  routeText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  map: {
    borderRadius: 8,
    height: 220,
    marginTop: 12,
    overflow: 'hidden',
  },
  actionText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.6,
  },
});

export default HomeScreen;
