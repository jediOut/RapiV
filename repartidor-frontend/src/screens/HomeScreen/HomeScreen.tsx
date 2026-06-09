import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  acceptDeliveryOffer,
  createCourierStripeOnboardingLink,
  type DeliveryOffer,
  fetchAssignedOrders,
  fetchCourierStripeProfile,
  fetchDeliveryOffers,
  fetchDeliveryLocation,
  markBusinessOrderPickedUp,
  notifyCustomerArrival,
  refreshCourierStripeStatus,
  updateDeliveryStatus,
  updateCourierLocation,
  updateCourierAvailability,
} from '../../services/orderApi';
import { sessionStorage } from '../../services/sessionStorage';
import { authApi } from '../../services/authApi';
import { Order } from '../../types/business';
import type { CourierStripeConnectProfile, User } from '../../types/auth';
import { colors } from '../../theme/colors';
import { VEGA_SERVICE_address } from '../../config/serviceZone';
import { VEGA_MAP_LIMITS, clampToVegaBounds, regionInVega } from '../../config/mapBounds';
import { StateView } from '../../components/StateView';
import { styles } from "./HomeScreen.styles";
import {
  ACTIVE_PARTIAL_DELIVERY_STATUSES,
  type Coordinates,
  formatStatus,
  getBusinessOrderPoint,
  getNextDeliveryStatus,
  getOrderFlowCopy,
  getPickupAddress,
  getPickupPoint,
  getRouteButtonLabel,
  getRouteDestination,
} from './HomeScreen.logic';

type ListedOrder = Order & {
  listMode: 'assigned' | 'offer' | 'history';
  offerId?: string;
  offerScore?: number;
};
type HomeScreenProps = {
  onLogout: () => void;
};

type CourierTab = 'work' | 'history' | 'profile';

function formatMoney(cents?: number | null) {
  return `$${((cents ?? 0) / 100).toFixed(2)}`;
}

function payoutStatusCopy(order: Order) {
  if (!order.courierPayoutCents) {
    return {
      label: 'Sin pago de reparto',
      detail: 'Esta orden no tiene pago de entrega registrado.',
      tone: 'neutral' as const,
    };
  }

  switch (order.courierPayoutStatus) {
    case 'PAID':
      return {
        label: 'Pagado',
        detail: order.courierPayoutPaidAt
          ? `Transferido ${new Date(order.courierPayoutPaidAt).toLocaleDateString('es-MX')}`
          : 'Transferencia completada.',
        tone: 'paid' as const,
      };
    case 'FAILED':
      return {
        label: 'Fallo',
        detail: order.courierPayoutError ?? 'Revisa Stripe Connect y actualiza el estado.',
        tone: 'failed' as const,
      };
    case 'CANCELLED':
      return {
        label: 'Cancelado',
        detail: 'La entrega no genero pago.',
        tone: 'neutral' as const,
      };
    case 'PENDING':
    default:
      return {
        label: 'Pendiente',
        detail: 'Se transferira cuando Stripe confirme que todo esta listo.',
        tone: 'pending' as const,
      };
  }
}

const HomeScreen: React.FC<HomeScreenProps> = ({ onLogout }) => {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<CourierTab>('work');
  const [user, setUser] = useState<User | null>(null);
  const [deliveryOffers, setDeliveryOffers] = useState<DeliveryOffer[]>([]);
  const [assignedOrders, setAssignedOrders] = useState<Order[]>([]);
  const [deliveryLocations, setDeliveryLocations] = useState<
    Record<string, { customer: { latitude: number; longitude: number } | null; courier: { latitude: number; longitude: number } | null }>
  >({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mutatingOrderId, setMutatingOrderId] = useState<string | null>(null);
  const [cashReceivedByOrder, setCashReceivedByOrder] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [stripeProfile, setStripeProfile] = useState<CourierStripeConnectProfile | null>(null);
  const [isUpdatingStripe, setIsUpdatingStripe] = useState(false);
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    username: '',
    email: '',
    phone: '',
  });

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

      const currentUser = await sessionStorage.getUser();
      setUser(currentUser);
      if (currentUser) {
        setProfileForm({
          fullName: currentUser.fullName ?? currentUser.name ?? '',
          username: currentUser.username ?? '',
          email: currentUser.email ?? '',
          phone: currentUser.phone ?? '',
        });
      }

      const [offers, assigned, courierStripeProfile] = await Promise.all([
        fetchDeliveryOffers(token),
        fetchAssignedOrders(token),
        fetchCourierStripeProfile(token),
      ]);
      const hasActiveDelivery = assigned.some((order) =>
        ACTIVE_PARTIAL_DELIVERY_STATUSES.includes(order.status as typeof ACTIVE_PARTIAL_DELIVERY_STATUSES[number])
      );
      await updateCourierAvailability(token, { status: hasActiveDelivery ? 'BUSY' : 'AVAILABLE' });

      setDeliveryOffers(offers);
      setAssignedOrders(assigned);
      setStripeProfile(courierStripeProfile);
      const active = assigned.filter((order) =>
        ACTIVE_PARTIAL_DELIVERY_STATUSES.includes(order.status as typeof ACTIVE_PARTIAL_DELIVERY_STATUSES[number])
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

  async function refreshOrders() {
    setRefreshing(true);
    try {
      await loadOrders();
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadOrders();
  }, []);

  useEffect(() => {
    const activeOrder = assignedOrders.find((order) =>
      ACTIVE_PARTIAL_DELIVERY_STATUSES.includes(order.status as typeof ACTIVE_PARTIAL_DELIVERY_STATUSES[number])
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
    await mutateOrder(order.id, async (token) => {
      const nextStatus = getNextDeliveryStatus(order);
      const cashReceivedCents =
        nextStatus === 'DELIVERED' && order.paymentMethod === 'CASH'
          ? Math.round(Number(cashReceivedByOrder[order.id]) * 100)
          : undefined;

      if (nextStatus === 'DELIVERED' && order.paymentMethod === 'CASH') {
        const receivedCents = cashReceivedCents ?? Number.NaN;
        if (!Number.isFinite(receivedCents) || receivedCents < order.totalCents) {
          throw new Error('Registra un efectivo recibido igual o mayor al total.');
        }
      }

      await updateDeliveryStatus(token, order.id, nextStatus, cashReceivedCents);
    });
  }

  async function handlePickupBusinessOrder(order: Order, businessOrderId: string) {
    await mutateOrder(order.id, async (token) => {
      await markBusinessOrderPickedUp(token, order.id, businessOrderId);
    });
  }

  async function handleNotifyArrival(order: Order) {
    await mutateOrder(order.id, async (token) => {
      await notifyCustomerArrival(token, order.id);
    });
  }

  async function openSuggestedRoute(destination: Coordinates) {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}&travelmode=driving`;
    await Linking.openURL(url);
  }

  async function callCustomer(phone: string) {
    await Linking.openURL(`tel:${phone}`);
  }

  function updateProfileForm(key: keyof typeof profileForm, value: string) {
    setProfileForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSaveProfile() {
    const normalizedEmail = profileForm.email.trim().toLowerCase();

    if (!profileForm.fullName.trim() || !profileForm.username.trim() || !normalizedEmail) {
      setProfileError('Nombre, usuario y correo son obligatorios.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setProfileError('Correo invalido.');
      return;
    }

    setIsSavingProfile(true);
    setProfileError(null);

    try {
      const updatedUser = await authApi.updateProfile({
        fullName: profileForm.fullName.trim(),
        username: profileForm.username.trim(),
        email: normalizedEmail,
        phone: profileForm.phone.trim(),
      });

      await sessionStorage.setUser(updatedUser);
      setUser(updatedUser);
      setProfileForm({
        fullName: updatedUser.fullName ?? updatedUser.name ?? '',
        username: updatedUser.username ?? '',
        email: updatedUser.email ?? '',
        phone: updatedUser.phone ?? '',
      });
      setIsEditingProfile(false);
    } catch (saveError) {
      setProfileError(saveError instanceof Error ? saveError.message : 'No se pudo actualizar el perfil.');
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleConnectStripe() {
    const token = await getToken();

    if (!token) {
      setProfileError('Tu sesion expiro. Inicia sesion nuevamente.');
      return;
    }

    setIsUpdatingStripe(true);
    setProfileError(null);

    try {
      const response = await createCourierStripeOnboardingLink(token);
      setStripeProfile(response.profile);

      const canOpen = await Linking.canOpenURL(response.url);

      if (!canOpen) {
        throw new Error('No se pudo abrir Stripe en este dispositivo');
      }

      await Linking.openURL(response.url);
    } catch (stripeError) {
      setProfileError(stripeError instanceof Error ? stripeError.message : 'No se pudo iniciar Stripe Connect.');
    } finally {
      setIsUpdatingStripe(false);
    }
  }

  async function handleRefreshStripeStatus() {
    const token = await getToken();

    if (!token) {
      setProfileError('Tu sesion expiro. Inicia sesion nuevamente.');
      return;
    }

    setIsUpdatingStripe(true);
    setProfileError(null);

    try {
      const profile = await refreshCourierStripeStatus(token);
      setStripeProfile(profile);
      setProfileError(
        profile.stripePayoutsEnabled
          ? null
          : 'Tu configuracion de Stripe aun esta pendiente.'
      );
    } catch (stripeError) {
      setProfileError(stripeError instanceof Error ? stripeError.message : 'No se pudo actualizar Stripe Connect.');
    } finally {
      setIsUpdatingStripe(false);
    }
  }

  function renderOrder(item: ListedOrder) {
    const orderItems = item.items ?? item.businessOrders?.flatMap((order) => order.items ?? []) ?? [];
    const businessOrders = item.businessOrders ?? [];
    const isMultiBusinessOrder = businessOrders.length > 1;
    const flowCopy = getOrderFlowCopy(item);
    const location = deliveryLocations[item.id];
    const customerLocation = location?.customer ?? undefined;
    const courierLocation = location?.courier ?? undefined;
    const businessLocation = getPickupPoint(item);
    const routeDestination = getRouteDestination(item, businessLocation, customerLocation);
    const hasCollectableBusinessOrder = businessOrders.some((order) => ['ASSIGNED', 'READY'].includes(order.status));
    const allBusinessOrdersPickedUp = businessOrders.length > 0 && businessOrders.every((order) => order.status === 'PICKED_UP');
    const payoutCopy = payoutStatusCopy(item);
    const nextLabel = hasCollectableBusinessOrder
      ? isMultiBusinessOrder
        ? ''
        : 'Marcar recogido'
      : allBusinessOrdersPickedUp || item.status === 'PICKED_UP'
        ? 'Salir a entregar'
        : item.status === 'ON_THE_WAY'
          ? 'Marcar entregado'
          : '';
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.orderId}>Numero de pedido RAP-{item.id.slice(0, 8).toUpperCase()}</Text>
            <Text style={styles.orderStatus}>
              {item.listMode === 'offer'
                ? `Oferta sugerida (${item.offerScore ?? 0})`
                : formatStatus(item.status)}
            </Text>
          </View>
          <View style={[
            styles.statusBadge,
            item.listMode === 'offer' && styles.offerBadge,
            item.status === 'DELIVERED' && styles.deliveredBadge,
          ]}>
            <Text style={[
              styles.statusBadgeText,
              item.listMode === 'offer' && styles.offerBadgeText,
              item.status === 'DELIVERED' && styles.deliveredBadgeText,
            ]}>
              {item.listMode === 'offer' ? 'Nueva' : formatStatus(item.status)}
            </Text>
          </View>
        </View>
        <View style={[styles.flowNotice, isMultiBusinessOrder && styles.multiFlowNotice]}>
          <Text style={styles.flowTitle}>{flowCopy.title}</Text>
          <Text style={styles.flowBody}>{flowCopy.body}</Text>
        </View>

        <Text style={styles.orderMeta}>
          {isMultiBusinessOrder ? 'Siguiente sugerido: ' : 'Recoger en: '}
          {getPickupAddress(item)}
        </Text>
        <Text style={styles.orderMeta}>Entregar en: {item.deliveryAddress}</Text>
        {item.customerName ? <Text style={styles.orderMeta}>Cliente: {item.customerName}</Text> : null}
        {item.customerPhone && item.status !== 'DELIVERED' ? (
          <TouchableOpacity onPress={() => callCustomer(item.customerPhone!)} style={styles.phoneButton}>
            <Text style={styles.phoneText}>Marcar: {item.customerPhone}</Text>
          </TouchableOpacity>
        ) : null}
          <Text style={styles.orderMeta}>Total: ${(item.totalCents / 100).toFixed(2)}</Text>
        {item.courierPayoutCents ? (
          <View style={styles.payoutPanel}>
            <View>
              <Text style={styles.payoutLabel}>Pago por entrega</Text>
              <Text style={styles.payoutAmount}>{formatMoney(item.courierPayoutCents)}</Text>
            </View>
            <View style={[
              styles.payoutBadge,
              payoutCopy.tone === 'paid' && styles.payoutBadgePaid,
              payoutCopy.tone === 'failed' && styles.payoutBadgeFailed,
              payoutCopy.tone === 'pending' && styles.payoutBadgePending,
            ]}>
              <Text style={[
                styles.payoutBadgeText,
                payoutCopy.tone === 'paid' && styles.payoutBadgeTextPaid,
                payoutCopy.tone === 'failed' && styles.payoutBadgeTextFailed,
                payoutCopy.tone === 'pending' && styles.payoutBadgeTextPending,
              ]}>
                {payoutCopy.label}
              </Text>
            </View>
            {item.listMode === 'history' || payoutCopy.tone === 'failed' ? (
              <Text style={styles.payoutDetail}>{payoutCopy.detail}</Text>
            ) : null}
          </View>
        ) : null}
        {item.paymentMethod === 'CASH' ? (
          <View style={styles.cashPanel}>
            <Text style={styles.cashTitle}>Pago en efectivo</Text>
            <Text style={styles.cashText}>
              Cobrar: ${(item.totalCents / 100).toFixed(2)}
              {item.paymentStatus === 'PAID' && item.cashReceivedCents !== null && item.cashReceivedCents !== undefined
                ? ` - Recibido: $${(item.cashReceivedCents / 100).toFixed(2)} - Cambio: $${((item.cashChangeCents ?? 0) / 100).toFixed(2)}`
                : ''}
            </Text>
            {item.status === 'ON_THE_WAY' && item.paymentStatus !== 'PAID' ? (
              <>
                <TextInput
                  keyboardType="decimal-pad"
                  onChangeText={(value) => setCashReceivedByOrder((current) => ({ ...current, [item.id]: value }))}
                  placeholder="Efectivo recibido"
                  placeholderTextColor={colors.muted}
                  style={styles.cashInput}
                  value={cashReceivedByOrder[item.id] ?? ''}
                />
                {Number(cashReceivedByOrder[item.id]) >= item.totalCents / 100 ? (
                  <Text style={styles.cashChange}>
                    Cambio: ${(Number(cashReceivedByOrder[item.id]) - item.totalCents / 100).toFixed(2)}
                  </Text>
                ) : null}
              </>
            ) : null}
          </View>
        ) : (
          <Text style={styles.orderMeta}>Pago: tarjeta</Text>
        )}

        {isMultiBusinessOrder ? (
          <>
            <Text style={styles.sectionTitle}>Recolecciones</Text>
            {businessOrders.map((businessOrder, index) => {
              const canPickUpBusinessOrder =
                item.listMode === 'assigned' && ['ASSIGNED', 'READY'].includes(businessOrder.status);
              const businessPoint = getBusinessOrderPoint(businessOrder);
              const isPickedUp = businessOrder.status === 'PICKED_UP';

              return (
                <View
                  key={businessOrder.id}
                  style={[
                    styles.pickupRow,
                    canPickUpBusinessOrder && styles.readyPickupRow,
                    isPickedUp && styles.pickedUpRow,
                  ]}
                >
                  <View style={styles.pickupHeader}>
                    <View style={styles.pickupTextGroup}>
                      <Text style={styles.pickupTitle}>Comercio {index + 1} - {formatStatus(businessOrder.status)}</Text>
                      <Text style={styles.pickupAddress}>{businessOrder.businessAddress ?? 'Direccion no disponible'}</Text>
                    </View>
                    <View style={styles.pickupActions}>
                      {businessPoint ? (
                        <TouchableOpacity
                          onPress={() => openSuggestedRoute(businessPoint)}
                          style={styles.pickupRouteButton}
                        >
                          <Text style={styles.pickupRouteText}>Ruta</Text>
                        </TouchableOpacity>
                      ) : null}
                      {canPickUpBusinessOrder ? (
                        <TouchableOpacity
                          disabled={mutatingOrderId === item.id}
                          onPress={() => handlePickupBusinessOrder(item, businessOrder.id)}
                          style={[styles.pickupButton, mutatingOrderId === item.id && styles.disabledButton]}
                        >
                          <Text style={styles.pickupButtonText}>Recoger</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                  {(businessOrder.items ?? []).map((product) => (
                    <Text key={`${businessOrder.id}-${product.productId}`} style={styles.pickupItem}>
                      {product.quantity} x {product.productName}
                    </Text>
                  ))}
                </View>
              );
            })}
          </>
        ) : null}

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
            maxZoomLevel={VEGA_MAP_LIMITS.maxZoomLevel}
            minZoomLevel={VEGA_MAP_LIMITS.minZoomLevel}
            pitchEnabled={false}
            region={regionInVega({
              latitude: customerLocation?.latitude ?? courierLocation?.latitude ?? VEGA_SERVICE_address.latitude,
              longitude: customerLocation?.longitude ?? courierLocation?.longitude ?? VEGA_SERVICE_address.longitude,
            })}
            rotateEnabled={false}
            scrollEnabled={false}
            style={styles.map}
            zoomEnabled={false}
          >
            {isMultiBusinessOrder ? (
              businessOrders.map((businessOrder, index) => {
                const point = getBusinessOrderPoint(businessOrder);

                if (!point) {
                  return null;
                }

                return (
                  <Marker
                    key={businessOrder.id}
                    coordinate={clampToVegaBounds(point)}
                    title={`Comercio ${index + 1}`}
                    description={`${formatStatus(businessOrder.status)} - ${businessOrder.businessAddress ?? ''}`}
                    pinColor={businessOrder.status === 'PICKED_UP' ? 'gray' : 'orange'}
                  />
                );
              })
            ) : businessLocation ? (
              <Marker
                coordinate={clampToVegaBounds(businessLocation)}
                title="Recoger en comercio"
                description={getPickupAddress(item)}
                pinColor="orange"
              />
            ) : null}
            {customerLocation ? (
              <Marker
                coordinate={clampToVegaBounds(customerLocation)}
                title="Entregar al cliente"
                description={item.deliveryAddress}
                pinColor="green"
              />
            ) : null}
            {courierLocation ? (
              <Marker coordinate={clampToVegaBounds(courierLocation)} title="Tu ubicacion" pinColor={colors.primary} />
            ) : null}
          </MapView>
        ) : null}

        {item.listMode === 'assigned' && routeDestination ? (
          <TouchableOpacity
            onPress={() => openSuggestedRoute(routeDestination)}
            style={styles.routeButton}
          >
            <Text style={styles.routeText}>{getRouteButtonLabel(item)}</Text>
          </TouchableOpacity>
        ) : null}

        {item.listMode === 'assigned' && item.status === 'ON_THE_WAY' ? (
          <TouchableOpacity
            disabled={mutatingOrderId === item.id}
            onPress={() => handleNotifyArrival(item)}
            style={[styles.arrivalButton, mutatingOrderId === item.id && styles.disabledButton]}
          >
            <Text style={styles.arrivalText}>
              {mutatingOrderId === item.id ? 'Avisando...' : 'Avisar que llegue'}
            </Text>
          </TouchableOpacity>
        ) : null}

        {item.listMode !== 'history' && (item.listMode === 'offer' || nextLabel) ? (
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
        ) : null}
      </View>
    );
  }

  const activeOrders = assignedOrders.filter((order) => order.status !== 'DELIVERED');
  const deliveredOrders = assignedOrders.filter((order) => order.status === 'DELIVERED');
  const listedOrders: ListedOrder[] = [
    ...activeOrders.map((order) => ({ ...order, listMode: 'assigned' as const })),
    ...deliveryOffers.map((offer) => ({
      ...offer.order,
      listMode: 'offer' as const,
      offerId: offer.id,
      offerScore: offer.score,
    })),
  ];
  const historyOrders: ListedOrder[] = deliveredOrders.map((order) => ({
    ...order,
    listMode: 'history' as const,
  }));
  const totalDeliveredCents = useMemo(
    () => deliveredOrders.reduce((sum, order) => sum + order.totalCents, 0),
    [deliveredOrders]
  );
  const deliveredPayoutCents = useMemo(
    () => deliveredOrders.reduce((sum, order) => sum + (order.courierPayoutCents ?? 0), 0),
    [deliveredOrders]
  );
  const paidPayoutCents = useMemo(
    () => deliveredOrders
      .filter((order) => order.courierPayoutStatus === 'PAID')
      .reduce((sum, order) => sum + (order.courierPayoutCents ?? 0), 0),
    [deliveredOrders]
  );
  const pendingPayoutCents = useMemo(
    () => assignedOrders
      .filter((order) => order.courierPayoutStatus === 'PENDING' || order.courierPayoutStatus === 'FAILED')
      .reduce((sum, order) => sum + (order.courierPayoutCents ?? 0), 0),
    [assignedOrders]
  );
  const isBusy = activeOrders.some((order) =>
    ACTIVE_PARTIAL_DELIVERY_STATUSES.includes(order.status as typeof ACTIVE_PARTIAL_DELIVERY_STATUSES[number])
  );
  const stripeReady = Boolean(stripeProfile?.stripeConnectedAccountId && stripeProfile.stripePayoutsEnabled);

  function renderHeader() {
    return (
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>RapiV Repartidor</Text>
          <Text style={styles.title}>
            {activeTab === 'work'
              ? 'Entregas'
              : activeTab === 'history'
                ? 'Historial'
                : 'Perfil'}
          </Text>
        </View>
        <TouchableOpacity onPress={refreshOrders} style={styles.refreshButton}>
          <Ionicons name="refresh" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>
    );
  }

  function renderWorkTab() {
    if (loading) {
      return <StateView title="Cargando pedidos" message="Estamos buscando pedidos listos y asignados." type="loading" />;
    }

    if (error) {
      return (
        <StateView
          actionLabel="Reintentar"
          message={error}
          onAction={loadOrders}
          title={error.includes('Sin conexion') ? 'Sin conexion' : 'No pudimos cargar los pedidos'}
          type="error"
        />
      );
    }

    if (listedOrders.length === 0) {
      return (
        <StateView
          actionLabel="Actualizar"
          message="Cuando el sistema te recomiende un pedido por zona y disponibilidad, aparecera aqui."
          onAction={loadOrders}
          title="No tienes ofertas disponibles"
        />
      );
    }

    return (
      <FlatList
        data={listedOrders}
        keyExtractor={(item) => `${item.listMode}-${item.id}`}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshOrders} />}
        ListHeaderComponent={
          !stripeReady ? (
            <View style={styles.stripeWorkNotice}>
              <Ionicons name="alert-circle-outline" size={19} color="#92400E" />
              <Text style={styles.stripeWorkNoticeText}>
                Configura Stripe Connect en Perfil para recibir transferencias automaticas de tus entregas.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => renderOrder(item)}
      />
    );
  }

  function renderHistoryTab() {
    if (loading) {
      return <StateView title="Cargando historial" message="Estamos consultando tus entregas." type="loading" />;
    }

    if (historyOrders.length === 0) {
      return (
        <StateView
          actionLabel="Actualizar"
          message="Tus pedidos entregados apareceran aqui cuando completes tus primeras entregas."
          onAction={loadOrders}
          title="Aun no tienes entregas completadas"
        />
      );
    }

    return (
      <FlatList
        data={historyOrders}
        keyExtractor={(item) => `history-${item.id}`}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshOrders} />}
        renderItem={({ item }) => renderOrder(item)}
      />
    );
  }

  function renderProfileTab() {
    const stripeStatusLabel = stripeReady
      ? 'Stripe Connect listo'
      : stripeProfile?.stripeConnectedAccountId
        ? 'Configuracion pendiente en Stripe'
        : 'Stripe Connect no configurado';
    const stripeStatusDescription = stripeReady
      ? 'Los pagos de reparto se podran enviar a tu cuenta conectada.'
      : 'Completa Stripe Connect para que RapiV pueda pagarte tus entregas. Tus datos bancarios se capturan directamente en Stripe.';

    return (
      <ScrollView
        contentContainerStyle={styles.profileContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshOrders} />}
      >
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.fullName?.charAt(0)?.toUpperCase() ?? 'R'}</Text>
          </View>
          <Text style={styles.profileName}>{user?.fullName ?? 'Repartidor'}</Text>
          <Text style={styles.profileEmail}>{user?.email ?? 'Cuenta de repartidor'}</Text>
          <View style={[styles.availabilityPill, isBusy && styles.busyPill]}>
            <Ionicons
              name={isBusy ? 'bicycle' : 'radio-button-on'}
              size={15}
              color={isBusy ? colors.warning : colors.success}
            />
            <Text style={styles.availabilityText}>{isBusy ? 'En entrega activa' : 'Disponible'}</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="card-outline" size={20} color={stripeReady ? colors.success : colors.primary} />
            <View style={styles.infoTextBlock}>
              <Text style={styles.infoTitle}>{stripeStatusLabel}</Text>
              <Text style={styles.infoText}>{stripeStatusDescription}</Text>
            </View>
          </View>
          {stripeReady ? null : (
            <View style={styles.stripeActions}>
              <TouchableOpacity
                disabled={isUpdatingStripe}
                onPress={handleConnectStripe}
                style={[styles.stripeButton, isUpdatingStripe && styles.disabledButton]}
              >
                <Text style={styles.stripeButtonText}>
                  {isUpdatingStripe
                    ? 'Abriendo...'
                    : stripeProfile?.stripeConnectedAccountId
                      ? 'Continuar Stripe'
                      : 'Configurar Stripe'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={isUpdatingStripe || !stripeProfile?.stripeConnectedAccountId}
                onPress={handleRefreshStripeStatus}
                style={[
                  styles.stripeButtonSecondary,
                  (isUpdatingStripe || !stripeProfile?.stripeConnectedAccountId) && styles.disabledButton,
                ]}
              >
                <Text style={styles.stripeButtonSecondaryText}>Actualizar estado</Text>
              </TouchableOpacity>
            </View>
          )}
          {profileError && !isEditingProfile ? <Text style={styles.stripeError}>{profileError}</Text> : null}
        </View>

        <View style={styles.infoCard}>
          <View style={styles.profileEditHeader}>
            <Text style={styles.infoTitle}>Datos de perfil</Text>
            <TouchableOpacity
              disabled={isSavingProfile}
              onPress={() => {
                setIsEditingProfile((current) => !current);
                setProfileError(null);
              }}
            >
              <Text style={styles.editProfileText}>{isEditingProfile ? 'Cancelar' : 'Editar'}</Text>
            </TouchableOpacity>
          </View>
          {isEditingProfile ? (
            <View style={styles.profileForm}>
              <TextInput value={profileForm.fullName} onChangeText={(value) => updateProfileForm('fullName', value)} placeholder="Nombre completo" placeholderTextColor={colors.muted} style={styles.profileInput} />
              <TextInput value={profileForm.username} onChangeText={(value) => updateProfileForm('username', value)} autoCapitalize="none" placeholder="Usuario" placeholderTextColor={colors.muted} style={styles.profileInput} />
              <TextInput value={profileForm.email} onChangeText={(value) => updateProfileForm('email', value)} autoCapitalize="none" keyboardType="email-address" placeholder="Correo" placeholderTextColor={colors.muted} style={styles.profileInput} />
              <TextInput value={profileForm.phone} onChangeText={(value) => updateProfileForm('phone', value)} keyboardType="phone-pad" placeholder="Telefono" placeholderTextColor={colors.muted} style={styles.profileInput} />
              {profileError ? <Text style={styles.profileError}>{profileError}</Text> : null}
              <TouchableOpacity disabled={isSavingProfile} onPress={handleSaveProfile} style={[styles.saveProfileButton, isSavingProfile && styles.disabledButton]}>
                <Text style={styles.saveProfileText}>{isSavingProfile ? 'Guardando...' : 'Guardar cambios'}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.infoText}>Usuario: {user?.username ?? 'Sin usuario'}</Text>
              <Text style={styles.infoText}>Telefono: {user?.phone ?? 'Sin telefono'}</Text>
            </>
          )}
        </View>

        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{activeOrders.length}</Text>
            <Text style={styles.metricLabel}>Activas</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{deliveredOrders.length}</Text>
            <Text style={styles.metricLabel}>Entregadas</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{formatMoney(deliveredPayoutCents)}</Text>
            <Text style={styles.metricLabel}>Ganado</Text>
          </View>
        </View>

        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{formatMoney(paidPayoutCents)}</Text>
            <Text style={styles.metricLabel}>Pagado</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{formatMoney(pendingPayoutCents)}</Text>
            <Text style={styles.metricLabel}>Pendiente</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>${(totalDeliveredCents / 100).toFixed(0)}</Text>
            <Text style={styles.metricLabel}>Valor entregado</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="star-outline" size={20} color={colors.primary} />
            <View style={styles.infoTextBlock}>
              <Text style={styles.infoTitle}>Valoraciones</Text>
              <Text style={styles.infoText}>Aun no hay calificaciones para mostrar.</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="navigate-outline" size={20} color={colors.primary} />
            <View style={styles.infoTextBlock}>
              <Text style={styles.infoTitle}>Zonas preferidas</Text>
              <Text style={styles.infoText}>Se usaran para recomendarte pedidos cercanos.</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={19} color="#B91C1C" />
          <Text style={styles.logoutText}>Cerrar sesion</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  function renderCurrentTab() {
    if (activeTab === 'history') {
      return renderHistoryTab();
    }

    if (activeTab === 'profile') {
      return renderProfileTab();
    }

    return renderWorkTab();
  }

  function renderTabButton(tab: CourierTab, icon: keyof typeof Ionicons.glyphMap, label: string) {
    const isActive = activeTab === tab;

    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => setActiveTab(tab)}
        style={[styles.tabButton, isActive && styles.activeTabButton]}
      >
        <Ionicons name={icon} size={21} color={isActive ? colors.primary : colors.muted} />
        <Text style={[styles.tabLabel, isActive && styles.activeTabLabel]}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      {renderHeader()}
      <View style={styles.content}>{renderCurrentTab()}</View>
      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {renderTabButton('work', 'bicycle-outline', 'Entregas')}
        {renderTabButton('history', 'receipt-outline', 'Historial')}
        {renderTabButton('profile', 'person-outline', 'Perfil')}
      </View>
    </View>
  );
};

export default HomeScreen;
