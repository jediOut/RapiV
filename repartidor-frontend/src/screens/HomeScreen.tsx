import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import { authApi } from '../services/authApi';
import { Order } from '../types/business';
import type { User } from '../types/auth';
import { colors } from '../theme/colors';
import { VEGA_SERVICE_address } from '../config/serviceZone';
import { StateView } from '../components/StateView';

type ListedOrder = Order & {
  listMode: 'assigned' | 'offer' | 'history';
  offerId?: string;
  offerScore?: number;
};
type HomeScreenProps = {
  onLogout: () => void;
};

const ACTIVE_DELIVERY_STATUSES = ['ASSIGNED', 'PICKED_UP', 'ON_THE_WAY'] as const;
type CourierTab = 'work' | 'history' | 'profile';
type Coordinates = { latitude: number; longitude: number };

const STATUS_LABELS: Record<string, string> = {
  ASSIGNED: 'Asignado',
  PICKED_UP: 'Recogido',
  ON_THE_WAY: 'En camino',
  DELIVERED: 'Entregado',
  READY_FOR_PICKUP: 'Listo para recoger',
};

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
  const [error, setError] = useState<string | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
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

      const [offers, assigned] = await Promise.all([
        fetchDeliveryOffers(token),
        fetchAssignedOrders(token),
      ]);
      const hasActiveDelivery = assigned.some((order) =>
        ACTIVE_DELIVERY_STATUSES.includes(order.status as typeof ACTIVE_DELIVERY_STATUSES[number])
      );
      await updateCourierAvailability(token, { status: hasActiveDelivery ? 'BUSY' : 'AVAILABLE' });

      setDeliveryOffers(offers);
      setAssignedOrders(assigned);
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

  async function openSuggestedRoute(destination: Coordinates) {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}&travelmode=driving`;
    await Linking.openURL(url);
  }

  async function callCustomer(phone: string) {
    await Linking.openURL(`tel:${phone}`);
  }

  function formatStatus(status: string) {
    return STATUS_LABELS[status] ?? status;
  }

  function getPickupPoint(order: Order): Coordinates | undefined {
    const businessOrder = order.businessOrders?.find(
      (current) => current.businessLatitude !== null && current.businessLatitude !== undefined
        && current.businessLongitude !== null && current.businessLongitude !== undefined
    );

    if (!businessOrder) {
      return undefined;
    }

    return {
      latitude: Number(businessOrder.businessLatitude),
      longitude: Number(businessOrder.businessLongitude),
    };
  }

  function getPickupAddress(order: Order) {
    return order.businessOrders?.find((current) => current.businessAddress)?.businessAddress ?? 'Direccion del negocio no disponible';
  }

  function getRouteDestination(order: Order, pickupLocation?: Coordinates, customerLocation?: Coordinates) {
    if (order.status === 'ASSIGNED') {
      return pickupLocation;
    }

    if (order.status === 'PICKED_UP' || order.status === 'ON_THE_WAY') {
      return customerLocation;
    }

    return undefined;
  }

  function getRouteButtonLabel(order: Order) {
    if (order.status === 'ASSIGNED') {
      return 'Ruta al negocio';
    }

    if (order.status === 'PICKED_UP' || order.status === 'ON_THE_WAY') {
      return 'Ruta al cliente';
    }

    return 'Abrir ruta sugerida';
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

  function renderOrder(item: ListedOrder) {
    const orderItems = item.items ?? item.businessOrders?.flatMap((order) => order.items ?? []) ?? [];
    const location = deliveryLocations[item.id];
    const customerLocation = location?.customer ?? undefined;
    const courierLocation = location?.courier ?? undefined;
    const businessLocation = getPickupPoint(item);
    const routeDestination = getRouteDestination(item, businessLocation, customerLocation);
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
      routeDestination,
    ].filter(Boolean) as Coordinates[];

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.orderId}>Pedido #{item.id.slice(0, 8)}</Text>
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
        <Text style={styles.orderMeta}>Recoger en: {getPickupAddress(item)}</Text>
        <Text style={styles.orderMeta}>Entregar en: {item.deliveryAddress}</Text>
        {item.customerName ? <Text style={styles.orderMeta}>Cliente: {item.customerName}</Text> : null}
        {item.customerPhone && item.status !== 'DELIVERED' ? (
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
                title="Recoger en negocio"
                description={getPickupAddress(item)}
                pinColor="orange"
              />
            ) : null}
            {customerLocation ? (
              <Marker
                coordinate={customerLocation}
                title="Entregar al cliente"
                description={item.deliveryAddress}
                pinColor="green"
              />
            ) : null}
            {courierLocation ? (
              <Marker coordinate={courierLocation} title="Tu ubicacion" pinColor={colors.primary} />
            ) : null}
            {suggestedRoute.length === 2 ? (
              <Polyline coordinates={suggestedRoute} strokeColor={colors.primary} strokeWidth={4} />
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

        {item.listMode !== 'history' ? (
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
  const isBusy = activeOrders.some((order) =>
    ACTIVE_DELIVERY_STATUSES.includes(order.status as typeof ACTIVE_DELIVERY_STATUSES[number])
  );

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
  },
  refreshButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 92,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
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
  statusBadge: {
    backgroundColor: '#EFF6FF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusBadgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  offerBadge: {
    backgroundColor: '#ECFDF5',
  },
  offerBadgeText: {
    color: colors.success,
  },
  deliveredBadge: {
    backgroundColor: '#F1F5F9',
  },
  deliveredBadgeText: {
    color: colors.muted,
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
  tabBar: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    left: 0,
    paddingHorizontal: 10,
    paddingTop: 8,
    position: 'absolute',
    right: 0,
  },
  tabButton: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    gap: 3,
    paddingVertical: 8,
  },
  activeTabButton: {
    backgroundColor: '#EFF6FF',
  },
  tabLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  activeTabLabel: {
    color: colors.primary,
  },
  profileContent: {
    paddingHorizontal: 16,
    paddingBottom: 108,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 20,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 999,
    height: 70,
    justifyContent: 'center',
    width: 70,
  },
  avatarText: {
    color: colors.primary,
    fontSize: 30,
    fontWeight: '900',
  },
  profileName: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 12,
    textAlign: 'center',
  },
  profileEmail: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  availabilityPill: {
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  busyPill: {
    backgroundColor: '#FFFBEB',
  },
  availabilityText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  metricCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: 12,
  },
  metricValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  metricLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 14,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 10,
  },
  infoTextBlock: {
    flex: 1,
  },
  infoTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  infoText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  profileEditHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  editProfileText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  profileForm: {
    gap: 10,
  },
  profileInput: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  profileError: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '700',
  },
  saveProfileButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
  },
  saveProfileText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '900',
  },
  logoutButton: {
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 14,
    paddingVertical: 13,
  },
  logoutText: {
    color: '#B91C1C',
    fontSize: 14,
    fontWeight: '900',
  },
});

export default HomeScreen;
