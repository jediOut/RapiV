import React, { useState, useEffect, useRef } from 'react';
import {
  Alert,
  AppState,
  View,
  SafeAreaView,
  Text,
  ScrollView,
  Linking,
  Pressable,
} from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Header from '../../components/Header';
import { StateView } from '../../components/StateView';
import { colors } from '../../theme/colors';
import { orderApi } from '../../services/orderApi';
import { paymentApi, Payment } from '../../services/paymentApi';
import { VEGA_SERVICE_address } from '../../config/serviceZone';
import { VEGA_MAP_LIMITS, clampToVegaBounds, regionInVega } from '../../config/mapBounds';
import { Order } from '../../types/business';
import { RootStackParamList } from '../../types/navigation';
import { PrimaryButton } from '../../components/PrimaryButton';
import { styles } from "./OrderDetailScreen.styles";
import { distanceInKm, getStatusColor, getStatusLabel, getStatusTextColor, orderPaymentLabel, paymentLabel } from './OrderDetailScreen.logic';
import { ratingApi } from '../../services/ratingApi';
import type { Rating } from '@rapidin/contracts';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderDetail'>;
const ratingGold = '#F59E0B';
const orderTimeline = [
  { key: 'received', label: 'Pedido recibido' },
  { key: 'preparing', label: 'Preparando' },
  { key: 'on_the_way', label: 'En camino' },
  { key: 'delivered', label: 'Entregado' },
] as const;

function getTimelineIndex(status: Order['status']) {
  if (status === 'delivered') {
    return 3;
  }

  if (status === 'assigned' || status === 'picked_up' || status === 'on_the_way') {
    return 2;
  }

  if (status === 'confirmed' || status === 'preparing' || status === 'ready') {
    return 1;
  }

  return 0;
}

export default function OrderDetailScreen({ navigation, route }: Props) {
  const { orderId } = route.params;
  const [order, setOrder] = useState<Order | null>(null);
  const [deliveryLocation, setDeliveryLocation] = useState<{
    customer: { latitude: number; longitude: number } | null;
    courier: { latitude: number; longitude: number } | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [submittingRatingTarget, setSubmittingRatingTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasNotifiedAtDoor = useRef(false);
  const paymentIdempotencyKeyRef = useRef<string | null>(null);

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  useEffect(() => {
    if (!pendingPaymentId || order?.paymentStatus === 'PAID') {
      setIsConfirmingPayment(false);
      return;
    }

    let attempts = 0;
    let isMounted = true;
    const paymentIdToSync = pendingPaymentId;

    async function syncPaymentStatus() {
      attempts += 1;
      setIsConfirmingPayment(true);

      try {
        const syncedPayment = await paymentApi.syncPayment(paymentIdToSync);
        const latestOrder = await orderApi.getOrderDetail(orderId);
        const latestPayments = await paymentApi.getOrderPayments(orderId);

        if (!isMounted) {
          return;
        }

        setOrder(latestOrder);
        setPayments([
          syncedPayment,
          ...latestPayments.filter((payment) => payment.id !== syncedPayment.id),
        ]);

        if (latestOrder.paymentStatus === 'PAID' || syncedPayment.status === 'SUCCEEDED') {
          setPendingPaymentId(null);
          setIsConfirmingPayment(false);
        }
      } catch {
        if (attempts >= 24 && isMounted) {
          setIsConfirmingPayment(false);
        }
      }
    }

    void syncPaymentStatus();
    const intervalId = setInterval(() => {
      if (attempts >= 24 || !pendingPaymentId) {
        clearInterval(intervalId);
        return;
      }

      void syncPaymentStatus();
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [order?.paymentStatus, orderId, pendingPaymentId]);

  useEffect(() => {
    if (pendingPaymentId || isConfirmingPayment || order?.paymentStatus === 'PAID') {
      return;
    }

    const recoverablePayment = payments.find((payment) =>
      payment.status === 'REQUIRES_ACTION' || payment.status === 'PROCESSING'
    );

    if (recoverablePayment) {
      setPendingPaymentId(recoverablePayment.id);
    }
  }, [isConfirmingPayment, order?.paymentStatus, payments, pendingPaymentId]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void loadOrder(false);
        void loadPayments();
      }
    });

    return () => subscription.remove();
  }, [orderId]);

  useEffect(() => {
    if (!order || !['assigned', 'picked_up', 'on_the_way'].includes(order.status)) {
      return;
    }

    let isMounted = true;

    async function shareAndLoadLocation() {
      try {
        const latestOrder = await orderApi.getOrderDetail(orderId);

        if (!['assigned', 'picked_up', 'on_the_way'].includes(latestOrder.status)) {
          if (isMounted) {
            setOrder(latestOrder);
            setDeliveryLocation(null);
          }
          return;
        }

        const permission = await Location.requestForegroundPermissionsAsync();

        if (permission.status === 'granted') {
          const current = await Location.getCurrentPositionAsync({});
          await orderApi.updateCustomerLocation(orderId, {
            latitude: current.coords.latitude,
            longitude: current.coords.longitude,
          });
        }

        const nextLocation = await orderApi.getDeliveryLocation(orderId);
        if (isMounted) {
          setOrder(latestOrder);
          setDeliveryLocation(nextLocation);

          if (
            !hasNotifiedAtDoor.current &&
            nextLocation.customer &&
            nextLocation.courier &&
            distanceInKm(nextLocation.customer, nextLocation.courier) <= 0.08
          ) {
            hasNotifiedAtDoor.current = true;
            Alert.alert('Tu pedido está en la puerta', 'El repartidor ya está muy cerca de tu ubicación.');
          }
        }
      } catch {
        if (isMounted) {
          setDeliveryLocation(null);
        }
      }
    }

    void shareAndLoadLocation();
    const intervalId = setInterval(() => {
      void shareAndLoadLocation();
    }, 10000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [order?.status, orderId]);

  const loadPayments = async () => {
    try {
      const data = await paymentApi.getOrderPayments(orderId);
      setPayments(data);
    } catch {
      setPayments([]);
    }
  };

  const loadRatings = async () => {
    try {
      const data = await ratingApi.getMyOrderRatings(orderId);
      setRatings(data);
    } catch {
      setRatings([]);
    }
  };

  const loadOrder = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);
      const data = await orderApi.getOrderDetail(orderId);
      setOrder(data);
      void loadPayments();
      void loadRatings();
    } catch (error) {
      console.error('Error loading order:', error);
      setOrder(null);
      setError(error instanceof Error ? error.message : 'No se pudo cargar el pedido');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  async function submitRating(targetType: 'BUSINESS' | 'COURIER', targetId: string, score: number) {
    setSubmittingRatingTarget(`${targetType}:${targetId}`);
    setRatingError(null);

    try {
      const existingRating = getRating(targetType, targetId);
      const rating = existingRating
        ? await ratingApi.updateRating(existingRating.id, { score })
        : await ratingApi.createRating({
            orderGroupId: orderId,
            targetType,
            targetId,
            score,
          });

      setRatings((current) => [
        rating,
        ...current.filter((item) => item.id !== rating.id),
      ]);
    } catch (error) {
      setRatingError(error instanceof Error ? error.message : 'No se pudo guardar la valoracion');
    } finally {
      setSubmittingRatingTarget(null);
    }
  }

  function getRating(targetType: 'BUSINESS' | 'COURIER', targetId: string) {
    return ratings.find((rating) => rating.targetType === targetType && rating.targetId === targetId);
  }

  function hasRating(targetType: 'BUSINESS' | 'COURIER', targetId: string) {
    return Boolean(getRating(targetType, targetId));
  }

  const handlePay = async () => {
    if (order?.paymentMethod === 'CASH') {
      return;
    }

    if (paymentLoading) {
      return;
    }

    setPaymentLoading(true);
    paymentIdempotencyKeyRef.current =
      paymentIdempotencyKeyRef.current ??
      `payment-${orderId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      const payment = await paymentApi.createPayment(orderId, paymentIdempotencyKeyRef.current);
      const checkoutUrl = payment.checkoutUrl ?? payment.clientSecret;

      if (!checkoutUrl) {
        Alert.alert('Pago no disponible', 'Stripe no devolvio una liga de pago.');
        return;
      }

      const canOpen = await Linking.canOpenURL(checkoutUrl);

      if (!canOpen) {
        Alert.alert('No se pudo abrir Stripe', 'Intenta de nuevo en unos segundos.');
        return;
      }

      await Linking.openURL(checkoutUrl);
      setPendingPaymentId(payment.id);
      setIsConfirmingPayment(true);
      setPayments((current) => [payment, ...current.filter((item) => item.id !== payment.id)]);
      Alert.alert('Pago iniciado', 'Cuando completes el pago, volveremos a actualizar el pedido.');
    } catch (error) {
      paymentIdempotencyKeyRef.current = null;
      Alert.alert('Error de pago', error instanceof Error ? error.message : 'No se pudo iniciar el pago');
    } finally {
      setPaymentLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Detalle del pedido" onBackPress={() => navigation.goBack()} />
        <StateView title="Cargando pedido" message="Estamos consultando el detalle del pedido." type="loading" />
      </SafeAreaView>
    );
  }

  if (error || !order) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Detalle del pedido" onBackPress={() => navigation.goBack()} />
        <StateView
          actionLabel={error?.includes('Sin conexion') ? 'Reintentar' : undefined}
          message={
            error?.includes('Sin conexion')
              ? error
              : 'El pedido no existe o ya no está disponible para esta cuenta.'
          }
          onAction={error?.includes('Sin conexion') ? loadOrder : undefined}
          title={error?.includes('Sin conexion') ? 'Sin conexión' : 'Pedido no encontrado'}
          type="error"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Detalle del pedido" onBackPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estado del pedido</Text>
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
          {order.paymentStatus === 'REFUNDED' ? (
            <View style={styles.refundNotice}>
              <Text style={styles.refundNoticeTitle}>Pago reembolsado</Text>
              <Text style={styles.refundNoticeBody}>
                Este pedido fue cancelado y el reembolso ya fue procesado. El banco puede tardar algunos días en reflejarlo en tu tarjeta.
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.nextStepCard}>
          <Text style={styles.nextStepEyebrow}>Qué sigue</Text>
          <Text style={styles.nextStepTitle}>
            {order.status === 'cancelled'
              ? 'Este pedido fue cancelado'
              : order.status === 'delivered'
                ? 'Pedido entregado'
                : getStatusLabel(order.status)}
          </Text>
          <View style={styles.timeline}>
            {orderTimeline.map((step, index) => {
              const isDone = order.status === 'delivered' || index <= getTimelineIndex(order.status);
              const isCurrent = index === getTimelineIndex(order.status) && order.status !== 'delivered';

              return (
                <View key={step.key} style={styles.timelineItem}>
                  <View style={[styles.timelineDot, isDone && styles.timelineDotDone, isCurrent && styles.timelineDotCurrent]}>
                    <Text style={[styles.timelineDotText, isDone && styles.timelineDotTextDone]}>{index + 1}</Text>
                  </View>
                  <Text style={[styles.timelineLabel, isDone && styles.timelineLabelDone]}>{step.label}</Text>
                  {index < orderTimeline.length - 1 ? (
                    <View style={[styles.timelineLine, isDone && styles.timelineLineDone]} />
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Artículos</Text>
          {order.items.map((item, index) => (
            <View key={index} style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.productName}</Text>
                <Text style={styles.itemQuantity}>
                  Cantidad: {item.quantity}
                </Text>
              </View>
              <Text style={styles.itemPrice}>
                ${(item.price * item.quantity).toFixed(2)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumen</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal:</Text>
            <Text style={styles.summaryValue}>
              ${order.totalPrice.toFixed(2)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total:</Text>
            <Text style={styles.totalValue}>
              ${order.totalPrice.toFixed(2)}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pago</Text>
          <View style={styles.paymentPanel}>
            <View>
              <Text style={styles.paymentStatus}>
                {orderPaymentLabel(order)}
              </Text>
              {order.paymentMethod === 'CASH' ? (
                <Text style={styles.paymentHint}>
                  Efectivo {order.fulfillmentMethod === 'PICKUP' ? 'al recoger' : 'al recibir'}: ${(order.totalPrice).toFixed(2)}
                  {order.cashReceivedCents !== null && order.cashReceivedCents !== undefined
                    ? ` - Recibido: $${(order.cashReceivedCents / 100).toFixed(2)} - Cambio: $${((order.cashChangeCents ?? 0) / 100).toFixed(2)}`
                    : ''}
                </Text>
              ) : payments[0] ? (
                <Text style={styles.paymentHint}>
                  Stripe: {isConfirmingPayment ? 'confirmando pago...' : paymentLabel(payments[0].status)}
                </Text>
              ) : (
                <Text style={styles.paymentHint}>
                  Paga con tarjeta para que el negocio pueda continuar.
                </Text>
              )}
            </View>
            {order.status === 'cancelled' || order.paymentMethod === 'CASH' || order.paymentStatus === 'PAID' || order.paymentStatus === 'REFUNDED' ? null : (
              <PrimaryButton
                disabled={paymentLoading || isConfirmingPayment}
                label={
                  paymentLoading
                    ? 'Abriendo pago...'
                    : isConfirmingPayment
                      ? 'Confirmando pago...'
                      : 'Pagar'
                }
                onPress={handlePay}
              />
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {order.fulfillmentMethod === 'PICKUP' ? 'Forma de entrega' : 'Dirección de entrega'}
          </Text>
          <Text style={styles.addressText}>
            {order.fulfillmentMethod === 'PICKUP'
              ? 'Recoger en negocio'
              : order.deliveryAddress}
          </Text>
        </View>

        {deliveryLocation ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ubicación de entrega</Text>
            <MapView
              initialRegion={VEGA_SERVICE_address}
              maxZoomLevel={VEGA_MAP_LIMITS.maxZoomLevel}
              minZoomLevel={VEGA_MAP_LIMITS.minZoomLevel}
              pitchEnabled={false}
              region={regionInVega({
                latitude: deliveryLocation.courier?.latitude ?? deliveryLocation.customer?.latitude ?? VEGA_SERVICE_address.latitude,
                longitude: deliveryLocation.courier?.longitude ?? deliveryLocation.customer?.longitude ?? VEGA_SERVICE_address.longitude,
              })}
              rotateEnabled={false}
              scrollEnabled={false}
              style={styles.map}
              zoomEnabled={false}
            >
              {deliveryLocation.customer ? (
                <Marker coordinate={clampToVegaBounds(deliveryLocation.customer)} title="Tu ubicación" />
              ) : null}
              {deliveryLocation.courier ? (
                <Marker coordinate={clampToVegaBounds(deliveryLocation.courier)} title="Repartidor" pinColor={colors.primary} />
              ) : null}
            </MapView>
          </View>
        ) : null}

        {order.status === 'delivered' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Valora tu experiencia</Text>
            {ratingError ? <Text style={styles.ratingError}>{ratingError}</Text> : null}
            {order.businessOrders?.map((businessOrder, index) => (
              <RatingRow
                key={businessOrder.id}
                disabled={Boolean(submittingRatingTarget)}
                label={`Comercio ${index + 1}`}
                onRate={(score) => submitRating('BUSINESS', businessOrder.businessId, score)}
                rating={getRating('BUSINESS', businessOrder.businessId)}
              />
            ))}
            {order.courierId ? (
              <RatingRow
                disabled={Boolean(submittingRatingTarget)}
                label="Repartidor"
                onRate={(score) => submitRating('COURIER', order.courierId!, score)}
                rating={getRating('COURIER', order.courierId)}
              />
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function RatingRow({
  disabled,
  label,
  onRate,
  rating,
}: {
  disabled: boolean;
  label: string;
  onRate: (score: number) => void;
  rating?: Rating;
}) {
  const score = rating?.score ?? 0;
  const canEdit = Boolean(rating && (rating.editCount ?? 0) < 1);
  const isLocked = disabled || Boolean(rating && !canEdit);

  return (
    <View style={styles.ratingRow}>
      <View style={styles.ratingHeader}>
        <Text style={styles.ratingLabel}>{label}</Text>
        {rating ? (
          <Text style={styles.ratingDone}>
            {canEdit ? 'Toca una estrella para corregir' : 'Valoración final'}
          </Text>
        ) : null}
      </View>
        <View style={styles.ratingStars}>
          {[1, 2, 3, 4, 5].map((ratingValue) => (
            <Pressable
              key={ratingValue}
              onPress={isLocked ? undefined : () => onRate(ratingValue)}
              style={[styles.ratingStarButton, isLocked && styles.ratingStarDisabled]}
            >
              <Ionicons
                name={ratingValue <= score ? 'star' : 'star-outline'}
                size={25}
                color={ratingGold}
              />
            </Pressable>
          ))}
        </View>
    </View>
  );
}
