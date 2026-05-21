import React, { useState, useEffect, useRef } from 'react';
import {
  Alert,
  AppState,
  View,
  StyleSheet,
  SafeAreaView,
  Text,
  ScrollView,
  Linking,
} from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Header from '../components/Header';
import { StateView } from '../components/StateView';
import { colors } from '../theme/colors';
import { orderApi } from '../services/orderApi';
import { paymentApi, Payment } from '../services/paymentApi';
import { VEGA_SERVICE_address } from '../config/serviceZone';
import { Order } from '../types/business';
import { RootStackParamList } from '../types/navigation';
import { PrimaryButton } from '../components/PrimaryButton';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderDetail'>;

const getStatusColor = (status: Order['status']) => {
  switch (status) {
    case 'pending':
      return colors.warning;
    case 'confirmed':
      return colors.warning;
    case 'preparing':
      return colors.warning;
    case 'ready':
      return colors.info;
    case 'assigned':
    case 'picked_up':
    case 'on_the_way':
      return colors.primary;
    case 'delivered':
      return colors.success;
    case 'cancelled':
      return colors.warning;
    default:
      return colors.textSecondary;
  }
};

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
            Alert.alert('Tu pedido esta en la puerta', 'El repartidor ya esta muy cerca de tu ubicacion.');
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

  const loadOrder = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);
      const data = await orderApi.getOrderDetail(orderId);
      setOrder(data);
      void loadPayments();
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

  const handlePay = async () => {
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
        Alert.alert('Pago no disponible', 'Mercado Pago no devolvio una liga de pago.');
        return;
      }

      const canOpen = await Linking.canOpenURL(checkoutUrl);

      if (!canOpen) {
        Alert.alert('No se pudo abrir Mercado Pago', 'Intenta de nuevo en unos segundos.');
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
        <Header title="Detalle Pedido" onBackPress={() => navigation.goBack()} />
        <StateView title="Cargando pedido" message="Estamos consultando el detalle del pedido." type="loading" />
      </SafeAreaView>
    );
  }

  if (error || !order) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Detalle Pedido" onBackPress={() => navigation.goBack()} />
        <StateView
          actionLabel={error?.includes('Sin conexion') ? 'Reintentar' : undefined}
          message={
            error?.includes('Sin conexion')
              ? error
              : 'El pedido no existe o ya no esta disponible para esta cuenta.'
          }
          onAction={error?.includes('Sin conexion') ? loadOrder : undefined}
          title={error?.includes('Sin conexion') ? 'Sin conexion' : 'Pedido no encontrado'}
          type="error"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Detalle Pedido" onBackPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estado del Pedido</Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(order.status) },
            ]}
          >
            <Text style={styles.statusText}>{order.status}</Text>
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
                {order.paymentStatus === 'PAID' ? 'Pagado' : 'Pendiente de pago'}
              </Text>
              {payments[0] ? (
                <Text style={styles.paymentHint}>
                  Mercado Pago: {isConfirmingPayment ? 'confirmando pago...' : paymentLabel(payments[0].status)}
                </Text>
              ) : (
                <Text style={styles.paymentHint}>
                  Paga con Mercado Pago para que el negocio pueda continuar.
                </Text>
              )}
            </View>
            {order.paymentStatus === 'PAID' ? null : (
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
          <Text style={styles.sectionTitle}>Direccion de entrega</Text>
          <Text style={styles.addressText}>{order.deliveryAddress}</Text>
        </View>

        {deliveryLocation ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ubicacion de entrega</Text>
            <MapView
              initialRegion={VEGA_SERVICE_address}
              region={{
                latitude:
                  deliveryLocation.courier?.latitude ??
                  deliveryLocation.customer?.latitude ??
                  VEGA_SERVICE_address.latitude,
                longitude:
                  deliveryLocation.courier?.longitude ??
                  deliveryLocation.customer?.longitude ??
                  VEGA_SERVICE_address.longitude,
                latitudeDelta: 0.04,
                longitudeDelta: 0.04,
              }}
              style={styles.map}
            >
              {deliveryLocation.customer ? (
                <Marker coordinate={deliveryLocation.customer} title="Tu ubicacion" />
              ) : null}
              {deliveryLocation.courier ? (
                <Marker coordinate={deliveryLocation.courier} title="Repartidor" pinColor={colors.primary} />
              ) : null}
            </MapView>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.background,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  itemQuantity: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 13,
    color: colors.text,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  addressText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  map: {
    borderRadius: 8,
    height: 240,
    overflow: 'hidden',
  },
  paymentPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 12,
  },
  paymentStatus: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  paymentHint: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
});

function paymentLabel(status: Payment['status']): string {
  const labels: Record<Payment['status'], string> = {
    REQUIRES_ACTION: 'esperando pago',
    PROCESSING: 'procesando',
    SUCCEEDED: 'aprobado',
    FAILED: 'rechazado',
    CANCELLED: 'cancelado',
  };

  return labels[status];
}

function distanceInKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
): number {
  const earthRadiusKm = 6371;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}
