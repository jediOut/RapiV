import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  acceptDeliveryOffer,
  createCourierWalletTopUp,
  createCourierWalletWithdrawal,
  createCourierStripeOnboardingLink,
  fetchCourierWallet,
  type DeliveryOffer,
  type CourierWalletSummary,
  fetchAssignedOrders,
  fetchCourierStripeProfile,
  fetchDeliveryOffers,
  fetchDeliveryLocation,
  markBusinessOrderPickedUp,
  notifyCustomerArrival,
  refreshCourierStripeStatus,
  syncCourierWalletTopUp,
  updateDeliveryStatus,
  updateCourierLocation,
  updateCourierAvailability,
} from '../../services/orderApi';
import { sessionStorage } from '../../services/sessionStorage';
import { authApi } from '../../services/authApi';
import { Order } from '../../types/business';
import type { CourierStripeConnectProfile, User } from '../../types/auth';
import { colors } from '../../theme/colors';
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
  isTerminalDeliveryStatus,
} from './HomeScreen.logic';

type ListedOrder = Order & {
  listMode: 'assigned' | 'offer' | 'history';
  offerId?: string;
  offerScore?: number;
};
type HomeScreenProps = {
  onLogout: () => void;
};

type CourierTab = 'work' | 'wallet' | 'history' | 'profile';

function formatMoney(cents?: number | null) {
  return `$${((cents ?? 0) / 100).toFixed(2)}`;
}

function isCashPayoutCollected(order: Order) {
  return order.paymentMethod === 'CASH' && order.paymentStatus === 'PAID' && Boolean(order.cashCollectedAt);
}

function payoutStatusCopy(order: Order) {
  if (!order.courierPayoutCents) {
    return {
      label: 'Sin pago de reparto',
      detail: 'Esta orden no tiene pago de entrega registrado.',
      tone: 'neutral' as const,
    };
  }

  if (isCashPayoutCollected(order)) {
    return {
      label: 'Pagado',
      detail: order.cashCollectedAt
        ? `Ganancia retenida del efectivo cobrado ${new Date(order.cashCollectedAt).toLocaleDateString('es-MX')}.`
        : 'Ganancia retenida del efectivo cobrado al cliente.',
      tone: 'paid' as const,
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
        detail: 'La entrega no generó pago.',
        tone: 'neutral' as const,
      };
    case 'PENDING':
    default:
      return {
        label: 'Pendiente',
        detail: 'Se transferirá cuando Stripe confirme que todo está listo.',
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
  const [wallet, setWallet] = useState<CourierWalletSummary | null>(null);
  const [topUpAmount, setTopUpAmount] = useState('300');
  const [withdrawAmount, setWithdrawAmount] = useState('100');
  const [lastTopUpId, setLastTopUpId] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [isCreatingTopUp, setIsCreatingTopUp] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isSyncingTopUp, setIsSyncingTopUp] = useState(false);
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

  async function loadOrders(options: { preserveCurrentOrders?: boolean } = {}) {
    if (!options.preserveCurrentOrders) {
      setLoading(true);
    }
    setError(null);

    try {
      const token = await getToken();

      if (!token) {
      setError('Tu sesión expiró. Inicia sesión nuevamente.');
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

      const assigned = await fetchAssignedOrders(token);
      const [offersResult, courierStripeProfileResult, courierWalletResult] = await Promise.allSettled([
        fetchDeliveryOffers(token),
        fetchCourierStripeProfile(token),
        fetchCourierWallet(token),
      ]);

      const offers = offersResult.status === 'fulfilled' ? offersResult.value : [];
      const courierStripeProfile =
        courierStripeProfileResult.status === 'fulfilled' ? courierStripeProfileResult.value : null;
      const courierWallet = courierWalletResult.status === 'fulfilled' ? courierWalletResult.value : null;

      if (courierStripeProfileResult.status === 'rejected') {
        setProfileError(
          courierStripeProfileResult.reason instanceof Error
            ? courierStripeProfileResult.reason.message
            : 'No pudimos cargar Stripe Connect.'
        );
      } else {
        setProfileError(null);
      }

      if (courierWalletResult.status === 'rejected') {
        setWalletError(
          courierWalletResult.reason instanceof Error
            ? courierWalletResult.reason.message
            : 'No pudimos cargar tu depósito.'
        );
      } else {
        setWalletError(null);
      }

      const hasActiveDelivery = assigned.some((order) =>
        ACTIVE_PARTIAL_DELIVERY_STATUSES.includes(order.status as typeof ACTIVE_PARTIAL_DELIVERY_STATUSES[number])
      );
      try {
        await updateCourierAvailability(token, { status: hasActiveDelivery ? 'BUSY' : 'AVAILABLE' });
      } catch (availabilityError) {
        setProfileError(
          availabilityError instanceof Error
            ? availabilityError.message
            : 'Configura Stripe Connect antes de recibir pedidos.'
        );
      }

      setDeliveryOffers(offers);
      setAssignedOrders(assigned);
      setStripeProfile(courierStripeProfile);
      setWallet(courierWallet);
      const active = assigned.filter((order) =>
        ACTIVE_PARTIAL_DELIVERY_STATUSES.includes(order.status as typeof ACTIVE_PARTIAL_DELIVERY_STATUSES[number])
      );
      const locations = await Promise.allSettled(
        active.map(async (order) => [order.id, await fetchDeliveryLocation(token, order.id)] as const)
      );
      setDeliveryLocations(Object.fromEntries(
        locations
          .filter((result): result is PromiseFulfilledResult<readonly [string, {
            customer: { latitude: number; longitude: number } | null;
            courier: { latitude: number; longitude: number } | null;
          }]> => result.status === 'fulfilled')
          .map((result) => result.value)
      ));
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : 'No se pudo cargar los pedidos';

      if (options.preserveCurrentOrders) {
        Alert.alert(
          'Pedido actualizado',
          `El pedido se actualizo, pero no pudimos refrescar la lista: ${message}`
        );
        return;
      }

      setError(message);
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
      try {
        const token = await getToken();
        if (!token) {
          return;
        }

        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          setError('Permite la ubicación para compartirla con el cliente durante la entrega');
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
            }).catch(() => {
              // Keep tracking alive even if a transient location sync fails.
            });
          }
        );
      } catch {
        setError('No se pudo iniciar el seguimiento de ubicación.');
      }
    }

    void startTracking();

    return () => {
      subscription?.remove();
    };
  }, [assignedOrders]);

  function applyUpdatedOrder(updatedOrder: Order) {
    setAssignedOrders((current) => {
      const existingIndex = current.findIndex((order) => order.id === updatedOrder.id);

      if (existingIndex < 0) {
        return [updatedOrder, ...current];
      }

      return current.map((order) => (order.id === updatedOrder.id ? updatedOrder : order));
    });

    if (isTerminalDeliveryStatus(updatedOrder.status)) {
      setDeliveryLocations((current) => {
        const next = { ...current };
        delete next[updatedOrder.id];
        return next;
      });
    }
  }

  async function mutateOrder<T>(
    orderId: string,
    mutation: (token: string) => Promise<T>,
    onSuccess?: (result: T) => void,
    options: { reloadAfterSuccess?: boolean } = {}
  ) {
    setMutatingOrderId(orderId);
    setError(null);

    try {
      const token = await getToken();

      if (!token) {
        setError('Necesitas iniciar sesión para actualizar pedidos');
        return;
      }

      const result = await mutation(token);
      onSuccess?.(result);
      if (options.reloadAfterSuccess !== false) {
        await loadOrders({ preserveCurrentOrders: true });
      }
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'No se pudo actualizar el pedido');
    } finally {
      setMutatingOrderId(null);
    }
  }

  async function handleAcceptOffer(orderId: string, offerId: string) {
    await mutateOrder(orderId, async (token) => {
      return acceptDeliveryOffer(token, offerId);
    }, applyUpdatedOrder);
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

      return updateDeliveryStatus(token, order.id, nextStatus, cashReceivedCents);
    }, (updatedOrder) => {
      applyUpdatedOrder(updatedOrder);

      if (updatedOrder.status === 'DELIVERED') {
        Alert.alert('Pedido entregado', 'El pedido quedo marcado como entregado.');
      }
    });
  }

  async function handlePickupBusinessOrder(order: Order, businessOrderId: string) {
    await mutateOrder(order.id, async (token) => {
      return markBusinessOrderPickedUp(token, order.id, businessOrderId);
    }, applyUpdatedOrder);
  }

  async function handleNotifyArrival(order: Order) {
    await mutateOrder(order.id, async (token) => {
      return notifyCustomerArrival(token, order.id);
    }, (result) => {
      Alert.alert(
        result.alreadyNotified ? 'Aviso ya enviado' : 'Aviso enviado',
        result.alreadyNotified
          ? 'El cliente ya tenia registrado este aviso.'
          : 'Se registro el aviso para el cliente.'
      );
    }, { reloadAfterSuccess: false });
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
      setProfileError('Correo inválido.');
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
      setProfileError('Tu sesión expiró. Inicia sesión nuevamente.');
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
      setProfileError('Tu sesión expiró. Inicia sesión nuevamente.');
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
          : 'Tu configuración de Stripe aún está pendiente.'
      );
    } catch (stripeError) {
      setProfileError(stripeError instanceof Error ? stripeError.message : 'No se pudo actualizar Stripe Connect.');
    } finally {
      setIsUpdatingStripe(false);
    }
  }

  async function handleCreateTopUp() {
    const token = await getToken();

    if (!token) {
      setWalletError('Tu sesión expiró. Inicia sesión nuevamente.');
      return;
    }

    const amountCents = Math.round(Number(topUpAmount) * 100);

    if (!Number.isFinite(amountCents) || amountCents < 20000) {
      setWalletError('El depósito mínimo es de $200.00 MXN.');
      return;
    }

    setIsCreatingTopUp(true);
    setWalletError(null);

    try {
      const topUp = await createCourierWalletTopUp(token, amountCents);
      setLastTopUpId(topUp.id);

      const checkoutUrl = topUp.checkoutUrl ?? topUp.clientSecret;

      if (!checkoutUrl) {
        throw new Error('Stripe no regresó una liga de pago.');
      }

      const canOpen = await Linking.canOpenURL(checkoutUrl);

      if (!canOpen) {
        throw new Error('No se pudo abrir Stripe en este dispositivo.');
      }

      await Linking.openURL(checkoutUrl);
    } catch (topUpError) {
      setWalletError(topUpError instanceof Error ? topUpError.message : 'No se pudo iniciar el depósito.');
    } finally {
      setIsCreatingTopUp(false);
    }
  }

  async function handleSyncLastTopUp() {
    const token = await getToken();

    if (!token || !lastTopUpId) {
      await loadOrders();
      return;
    }

    setIsSyncingTopUp(true);
    setWalletError(null);

    try {
      await syncCourierWalletTopUp(token, lastTopUpId);
      const nextWallet = await fetchCourierWallet(token);
      setWallet(nextWallet);
      setWalletError(null);
    } catch (syncError) {
      setWalletError(syncError instanceof Error ? syncError.message : 'No se pudo actualizar el depósito.');
    } finally {
      setIsSyncingTopUp(false);
    }
  }

  async function handleWithdrawWallet() {
    const token = await getToken();

    if (!token) {
      setWalletError('Tu sesión expiró. Inicia sesión nuevamente.');
      return;
    }

    if (!stripeReady) {
      setWalletError('Configura Stripe Connect en Perfil antes de retirar tu depósito.');
      return;
    }

    const amountCents = Math.round(Number(withdrawAmount) * 100);
    const availableCents = wallet?.availableCents ?? 0;

    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setWalletError('Escribe un monto válido para retirar.');
      return;
    }

    if (amountCents > availableCents) {
      setWalletError(`Solo puedes retirar tu saldo disponible: ${formatMoney(availableCents)}.`);
      return;
    }

    setIsWithdrawing(true);
    setWalletError(null);

    try {
      await createCourierWalletWithdrawal(token, amountCents);
      const nextWallet = await fetchCourierWallet(token);
      setWallet(nextWallet);
      setWithdrawAmount('');
    } catch (withdrawError) {
      setWalletError(withdrawError instanceof Error ? withdrawError.message : 'No se pudo retirar el depósito.');
    } finally {
      setIsWithdrawing(false);
    }
  }

  function renderOrder(item: ListedOrder) {
    const orderItems = item.items ?? item.businessOrders?.flatMap((order) => order.items ?? []) ?? [];
    const businessOrders = item.businessOrders ?? [];
    const isMultiBusinessOrder = businessOrders.length > 1;
    const flowCopy = getOrderFlowCopy(item);
    const location = deliveryLocations[item.id];
    const customerLocation = location?.customer ?? undefined;
    const businessLocation = getPickupPoint(item);
    const routeDestination = getRouteDestination(item, businessLocation, customerLocation);
    const hasCollectableBusinessOrder = businessOrders.some((order) => ['ASSIGNED', 'READY'].includes(order.status));
    const allBusinessOrdersPickedUp = businessOrders.length > 0 && businessOrders.every((order) => order.status === 'PICKED_UP');
    const isHistoryItem = item.listMode === 'history';
    const isNotCompletedHistoryItem = isHistoryItem && item.status !== 'DELIVERED';
    const payoutCopy = payoutStatusCopy(item);
    const cashSettlementRequiredCents =
      item.cashSettlementRequiredCents ?? Math.max(0, item.totalCents - (item.courierPayoutCents ?? 0));
    const isCashOrderSettled = item.paymentMethod === 'CASH' && item.paymentStatus === 'PAID';
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
          <View style={styles.cardHeaderText}>
            <Text style={styles.orderId}>Número de pedido RAP-{item.id.slice(0, 8).toUpperCase()}</Text>
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
            isNotCompletedHistoryItem && styles.notCompletedBadge,
          ]}>
            <Text style={[
              styles.statusBadgeText,
              item.listMode === 'offer' && styles.offerBadgeText,
              item.status === 'DELIVERED' && styles.deliveredBadgeText,
              isNotCompletedHistoryItem && styles.notCompletedBadgeText,
            ]}>
              {item.listMode === 'offer' ? 'Nueva' : formatStatus(item.status)}
            </Text>
          </View>
        </View>
        {isNotCompletedHistoryItem ? (
          <View style={styles.historyNotice}>
            <Text style={styles.historyNoticeTitle}>Pedido no completado</Text>
            <Text style={styles.historyNoticeText}>Este pedido terminó como {formatStatus(item.status).toLowerCase()} y ya no requiere acción.</Text>
          </View>
        ) : null}
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
        {item.customerPhone && !isHistoryItem && item.status !== 'DELIVERED' ? (
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
              Cobra al cliente: ${(item.totalCents / 100).toFixed(2)}
              {item.paymentStatus === 'PAID' && item.cashReceivedCents !== null && item.cashReceivedCents !== undefined
                ? ` - Recibido: $${(item.cashReceivedCents / 100).toFixed(2)} - Cambio: $${((item.cashChangeCents ?? 0) / 100).toFixed(2)}`
                : ''}
            </Text>
            <Text style={styles.cashText}>
              {isCashOrderSettled ? 'Ya se descontó' : 'Se reservará'} de tu depósito RapiV: {formatMoney(cashSettlementRequiredCents)}. Tu ganancia queda como {formatMoney(item.courierPayoutCents ?? 0)}.
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
                      <Text style={styles.pickupAddress}>{businessOrder.businessAddress ?? 'Dirección no disponible'}</Text>
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

        <Text style={styles.sectionTitle}>Artículos</Text>
        {orderItems.length > 0 ? (
          orderItems.map((product) => (
            <Text key={`${item.id}-${product.productId}`} style={styles.orderItem}>
              {product.quantity} x {product.productName}
            </Text>
          ))
        ) : (
          <Text style={styles.orderItem}>Productos no disponibles en este momento</Text>
        )}

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
                  ? 'Aceptar pedido'
                  : item.paymentMethod === 'CASH' && item.status === 'ON_THE_WAY'
                    ? 'Cobrar y pagar orden'
                  : nextLabel}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  const activeOrders = assignedOrders.filter((order) => !isTerminalDeliveryStatus(order.status));
  const terminalOrders = assignedOrders.filter((order) => isTerminalDeliveryStatus(order.status));
  const deliveredOrders = terminalOrders.filter((order) => order.status === 'DELIVERED');
  const notCompletedOrders = terminalOrders.filter((order) => order.status !== 'DELIVERED');
  const listedOrders: ListedOrder[] = [
    ...activeOrders.map((order) => ({ ...order, listMode: 'assigned' as const })),
    ...deliveryOffers
      .filter((offer) => !isTerminalDeliveryStatus(offer.order.status))
      .map((offer) => ({
        ...offer.order,
        listMode: 'offer' as const,
        offerId: offer.id,
        offerScore: offer.score,
      })),
  ];
  const historyOrders: ListedOrder[] = terminalOrders.map((order) => ({
    ...order,
    listMode: 'history' as const,
  }));
  const deliveredPayoutCents = useMemo(
    () => deliveredOrders.reduce((sum, order) => sum + (order.courierPayoutCents ?? 0), 0),
    [deliveredOrders]
  );
  const paidPayoutCents = useMemo(
    () => deliveredOrders
      .filter((order) => order.courierPayoutStatus === 'PAID' || isCashPayoutCollected(order))
      .reduce((sum, order) => sum + (order.courierPayoutCents ?? 0), 0),
    [deliveredOrders]
  );
  const pendingPayoutCents = useMemo(
    () => assignedOrders
      .filter((order) =>
        !isCashPayoutCollected(order) &&
        (order.courierPayoutStatus === 'PENDING' || order.courierPayoutStatus === 'FAILED')
      )
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
        <View style={styles.headerTitleRow}>
          <Image source={require("../../../assets/icon.png")} style={styles.headerLogo} />
          <View>
            <Text style={styles.eyebrow}>RapiV Repartidor</Text>
            <Text style={styles.title}>
              {activeTab === 'work'
                ? 'Entregas'
                : activeTab === 'wallet'
                  ? 'Depósitos'
                : activeTab === 'history'
                  ? 'Historial'
                  : 'Perfil'}
            </Text>
          </View>
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
          title={error.includes('Sin conexion') ? 'Sin conexión' : 'No pudimos cargar los pedidos'}
          type="error"
        />
      );
    }

    if (listedOrders.length === 0) {
      return (
        <StateView
          actionLabel="Actualizar"
          message="Cuando el sistema te recomiende un pedido por zona y disponibilidad, aparecerá aquí."
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
          <>
            {!stripeReady ? (
              <View style={styles.stripeWorkNotice}>
                <Ionicons name="alert-circle-outline" size={19} color="#92400E" />
                <Text style={styles.stripeWorkNoticeText}>
                  Configura Stripe Connect en Perfil para recibir transferencias y ofertas.
                </Text>
              </View>
            ) : null}
            {wallet ? (
              <View style={styles.walletWorkNotice}>
                <View>
                  <Text style={styles.walletWorkLabel}>Depósito disponible para efectivo</Text>
                  <Text style={styles.walletWorkAmount}>{formatMoney(wallet.availableCents)}</Text>
                  <Text style={styles.walletWorkDetail}>
                    Lo necesitas para tomar pedidos pagados en efectivo.
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setActiveTab('wallet')} style={styles.walletWorkButton}>
                  <Text style={styles.walletWorkButtonText}>Depositar</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.walletSetupNotice}>
                <Ionicons name="wallet-outline" size={20} color={colors.primary} />
                <View style={styles.infoTextBlock}>
                  <Text style={styles.walletSetupTitle}>Depósito para recibir pedidos en efectivo</Text>
                  <Text style={styles.walletSetupText}>
                    Recarga tu depósito RapiV para cubrir órdenes en efectivo y poder recibir más ofertas.
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setActiveTab('wallet')} style={styles.walletSetupButton}>
                  <Text style={styles.walletSetupButtonText}>Ver</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        }
        renderItem={({ item }) => renderOrder(item)}
      />
    );
  }

  function renderWalletTab() {
    const recentTransactions = wallet?.recentTransactions ?? [];
    const walletBalanceCents = wallet?.balanceCents ?? 0;
    const walletAvailableCents = wallet?.availableCents ?? 0;
    const walletCommittedCents = wallet?.activeCashCommitmentCents ?? 0;

    return (
      <ScrollView
        contentContainerStyle={styles.profileContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshOrders} />}
      >
        <View style={styles.walletBalanceCard}>
          <Text style={styles.walletLabel}>Depósito disponible para efectivo</Text>
          <Text style={styles.walletBalance}>{formatMoney(walletAvailableCents)}</Text>
          <Text style={styles.walletDetail}>
            Saldo total depositado: {formatMoney(walletBalanceCents)}
          </Text>
          {walletCommittedCents ? (
            <Text style={styles.walletDetail}>
              Comprometido en entregas activas: {formatMoney(walletCommittedCents)}
            </Text>
          ) : null}
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Hacer depósito</Text>
          <Text style={styles.infoText}>
            Este depósito se usa para cubrir a RapiV las órdenes en efectivo cuando las entregas.
            Mientras más depósito disponible tengas, más pedidos en efectivo podrás recibir.
          </Text>
          <TextInput
            keyboardType="decimal-pad"
            onChangeText={setTopUpAmount}
            placeholder="Monto del depósito"
            placeholderTextColor={colors.muted}
            style={styles.profileInput}
            value={topUpAmount}
          />
          <TouchableOpacity
            disabled={isCreatingTopUp}
            onPress={handleCreateTopUp}
            style={[styles.saveProfileButton, isCreatingTopUp && styles.disabledButton]}
          >
            <Text style={styles.saveProfileText}>{isCreatingTopUp ? 'Abriendo Stripe...' : 'Depositar con Stripe'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            disabled={isSyncingTopUp}
            onPress={handleSyncLastTopUp}
            style={[styles.stripeButtonSecondary, styles.walletSyncButton, isSyncingTopUp && styles.disabledButton]}
          >
            <Text style={styles.stripeButtonSecondaryText}>
              {isSyncingTopUp ? 'Actualizando...' : 'Actualizar depósito'}
            </Text>
          </TouchableOpacity>
          {walletError ? <Text style={styles.profileError}>{walletError}</Text> : null}
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Retirar depósito</Text>
          <Text style={styles.infoText}>
            Puedes retirar el saldo disponible a tu cuenta de Stripe Connect. El saldo comprometido en entregas activas no se puede retirar.
          </Text>
          <TextInput
            keyboardType="decimal-pad"
            onChangeText={setWithdrawAmount}
            placeholder="Monto a retirar"
            placeholderTextColor={colors.muted}
            style={styles.profileInput}
            value={withdrawAmount}
          />
          <TouchableOpacity
            disabled={isWithdrawing || !stripeReady || walletAvailableCents <= 0}
            onPress={handleWithdrawWallet}
            style={[
              styles.withdrawButton,
              (isWithdrawing || !stripeReady || walletAvailableCents <= 0) && styles.disabledButton
            ]}
          >
            <Text style={styles.withdrawButtonText}>
              {isWithdrawing ? 'Retirando...' : 'Retirar a Stripe'}
            </Text>
          </TouchableOpacity>
          {!stripeReady ? (
            <Text style={styles.infoText}>Activa Stripe Connect en Perfil para retirar tu depósito.</Text>
          ) : null}
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Movimientos recientes</Text>
          {recentTransactions.length ? (
            recentTransactions.map((transaction) => (
              <View key={transaction.id} style={styles.walletTransactionRow}>
                <View style={styles.infoTextBlock}>
                  <Text style={styles.walletTransactionTitle}>
                    {transaction.type === 'TOP_UP'
                      ? 'Depósito'
                      : transaction.type === 'CASH_ORDER_SETTLEMENT'
                        ? 'Orden en efectivo'
                        : transaction.type === 'WITHDRAWAL'
                          ? 'Retiro'
                          : 'Ajuste'}
                  </Text>
                  <Text style={styles.infoText}>
                    {new Date(transaction.createdAt).toLocaleString('es-MX')}
                  </Text>
                </View>
                <Text style={[
                  styles.walletTransactionAmount,
                  transaction.amountCents >= 0 ? styles.walletTransactionPositive : styles.walletTransactionNegative,
                ]}>
                  {transaction.amountCents >= 0 ? '+' : ''}{formatMoney(transaction.amountCents)}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.infoText}>Aún no tienes movimientos de depósito.</Text>
          )}
        </View>
      </ScrollView>
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
          message="Tus pedidos entregados, cancelados o no completados aparecerán aquí."
          onAction={loadOrders}
          title="Aún no tienes entregas completadas"
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
        ? 'Configuración pendiente en Stripe'
        : 'Stripe Connect no configurado';
    const stripeStatusDescription = stripeReady
      ? 'Los pagos de reparto se podrán enviar a tu cuenta conectada.'
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
              <Text style={styles.infoText}>Teléfono: {user?.phone ?? 'Sin teléfono'}</Text>
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
            <Text style={styles.metricValue}>{notCompletedOrders.length}</Text>
            <Text style={styles.metricLabel}>No completadas</Text>
          </View>
        </View>

        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{formatMoney(deliveredPayoutCents)}</Text>
            <Text style={styles.metricLabel}>Ganado</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{formatMoney(paidPayoutCents)}</Text>
            <Text style={styles.metricLabel}>Pagado</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{formatMoney(pendingPayoutCents)}</Text>
            <Text style={styles.metricLabel}>Pendiente</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="star-outline" size={20} color={colors.primary} />
            <View style={styles.infoTextBlock}>
              <Text style={styles.infoTitle}>Valoraciones</Text>
              <Text style={styles.infoText}>Aún no hay calificaciones para mostrar.</Text>
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
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  function renderCurrentTab() {
    if (activeTab === 'history') {
      return renderHistoryTab();
    }

    if (activeTab === 'wallet') {
      return renderWalletTab();
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
        {renderTabButton('wallet', 'wallet-outline', 'Depósitos')}
        {renderTabButton('history', 'receipt-outline', 'Historial')}
        {renderTabButton('profile', 'person-outline', 'Perfil')}
      </View>
    </View>
  );
};

export default HomeScreen;
