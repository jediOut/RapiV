import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Header from '../../components/Header';
import { CustomerTabBar } from '../../components/CustomerTabBar';
import { colors } from '../../theme/colors';
import { useCart } from '../../context/CartContext';
import { orderApi } from '../../services/orderApi';
import { businessApi } from '../../services/businessApi';
import { sessionStorage } from '../../services/sessionStorage';
import { RootStackParamList } from '../../types/navigation';
import type { Business } from '../../types/business';
import { PrimaryButton } from '../../components/PrimaryButton';
import { VEGA_SERVICE_address } from '../../config/serviceZone';
import { resolveAddressFromCoordinates } from '../../utils/locationAddress';

type Props = NativeStackScreenProps<RootStackParamList, 'Cart'>;
type DeliveryLocation = {
  latitude: number;
  longitude: number;
};

const DELIVERY_FEE_CENTS = 3000;
const CARD_PAYMENT_MINIMUM_CENTS = 18000;

export default function CartScreen({ navigation }: Props) {
  const { cart, subtotalCents, clearCart } = useCart();
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState<DeliveryLocation | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CARD' | 'CASH'>('CARD');
  const [fulfillmentMethod, setFulfillmentMethod] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');
  const [businessRules, setBusinessRules] = useState<Record<string, Business>>({});
  const isSubmittingRef = useRef(false);
  const checkoutIdempotencyKeyRef = useRef<string | null>(null);

  const subtotal = subtotalCents / 100;
  const deliveryFeeCents = fulfillmentMethod === 'DELIVERY' ? DELIVERY_FEE_CENTS : 0;
  const deliveryFee = deliveryFeeCents / 100;
  const total = (subtotalCents + deliveryFeeCents) / 100;
  const uniqueBusinessIds = useMemo(
    () => [...new Set(cart.map((item) => item.product.businessId))],
    [cart]
  );
  const acceptsCash = uniqueBusinessIds.every((businessId) => businessRules[businessId]?.acceptsCash !== false);
  const acceptsCard = uniqueBusinessIds.every((businessId) => businessRules[businessId]?.acceptsCard !== false);
  const meetsCardMinimum = subtotalCents >= CARD_PAYMENT_MINIMUM_CENTS;
  const cardAvailable = acceptsCard && meetsCardMinimum;
  const cardMinimum = CARD_PAYMENT_MINIMUM_CENTS / 100;
  const minimumIssues = cart
    .map((item) => {
      const minimum = item.product.minimumQuantityPerOrder ?? 1;
      return item.quantity < minimum
        ? `${item.product.name} requiere minimo ${minimum} por pedido.`
        : null;
    })
    .filter(Boolean) as string[];

  useEffect(() => {
    let isMounted = true;

    async function loadBusinessRules() {
      const missingIds = uniqueBusinessIds.filter((businessId) => !businessRules[businessId]);

      if (!missingIds.length) {
        return;
      }

      try {
        const details = await Promise.all(
          missingIds.map((businessId) => businessApi.getBusinessDetail(businessId))
        );

        if (isMounted) {
          setBusinessRules((current) => ({
            ...current,
            ...Object.fromEntries(details.map((business) => [business.id, business])),
          }));
        }
      } catch {
        // El backend valida estas reglas si no se pudieron cargar en el cliente.
      }
    }

    void loadBusinessRules();

    return () => {
      isMounted = false;
    };
  }, [businessRules, uniqueBusinessIds]);

  useEffect(() => {
    if (paymentMethod === 'CASH' && !acceptsCash && cardAvailable) {
      setPaymentMethod('CARD');
    }

    if (paymentMethod === 'CARD' && !cardAvailable && acceptsCash) {
      setPaymentMethod('CASH');
    }
  }, [acceptsCash, cardAvailable, paymentMethod]);

  useEffect(() => {
    async function loadLastDeliveryAddress() {
      const lastDeliveryAddress = await sessionStorage.getLastDeliveryAddress();

      if (!lastDeliveryAddress) {
        return;
      }

      setDeliveryAddress(lastDeliveryAddress.address);
      setDeliveryLocation({
        latitude: lastDeliveryAddress.latitude,
        longitude: lastDeliveryAddress.longitude,
      });
    }

    void loadLastDeliveryAddress();
  }, []);

  const requestDeliveryLocation = async () => {
    setIsLocating(true);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        Alert.alert(
          'Ubicacion requerida',
          'Permite acceder a tu ubicacion para enviar el pedido de forma segura.'
        );
        return null;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const nextLocation = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };

      if (!isInsideServiceaddress(nextLocation.latitude, nextLocation.longitude)) {
        Alert.alert('Fuera de zona', 'Por ahora RapiV solo opera en Vega de Alatorre y alrededores.');
        return null;
      }

      const resolvedAddress = await resolveAddressFromCoordinates(nextLocation);
      setDeliveryLocation(nextLocation);

      if (!deliveryAddress.trim()) {
        setDeliveryAddress(resolvedAddress ?? 'Ubicacion GPS confirmada');
      }

      return nextLocation;
    } catch {
      Alert.alert('Error de ubicacion', 'No se pudo obtener la ubicacion del telefono.');
      return null;
    } finally {
      setIsLocating(false);
    }
  };

  const submitCheckout = async (safeLocation: DeliveryLocation | null) => {
    if (isSubmittingRef.current) {
      return;
    }

    isSubmittingRef.current = true;
    setIsProcessing(true);
    checkoutIdempotencyKeyRef.current =
      checkoutIdempotencyKeyRef.current ??
      `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      const order = await orderApi.createOrder(
        {
          deliveryAddress: fulfillmentMethod === 'DELIVERY'
            ? deliveryAddress.trim()
            : 'Recoger en negocio',
          fulfillmentMethod,
          paymentMethod,
          latitude: safeLocation?.latitude,
          longitude: safeLocation?.longitude,
          items: cart.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
          })),
        },
        checkoutIdempotencyKeyRef.current
      );

      if (fulfillmentMethod === 'DELIVERY' && safeLocation) {
        await sessionStorage.saveLastDeliveryAddress({
          address: deliveryAddress.trim(),
          latitude: safeLocation.latitude,
          longitude: safeLocation.longitude,
        });
      }

      clearCart();
      checkoutIdempotencyKeyRef.current = null;
      Alert.alert(
        'Pedido creado',
        fulfillmentMethod === 'PICKUP'
          ? paymentMethod === 'CASH'
            ? 'Tu pedido fue enviado al negocio. Pagaras en efectivo al recogerlo.'
            : 'Tu pedido fue creado. Puedes pagarlo con tarjeta y recogerlo cuando este listo.'
          : paymentMethod === 'CASH'
            ? 'Tu pedido fue enviado al negocio. Pagaras en efectivo al recibirlo.'
            : 'Tu pedido fue creado. Puedes pagarlo con tarjeta.'
      );
      navigation.navigate('OrderDetail', { orderId: order.id });
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo crear el pedido');
    } finally {
      isSubmittingRef.current = false;
      setIsProcessing(false);
    }
  };

  const handleCheckout = async () => {
    if (isSubmittingRef.current) {
      return;
    }

    if (cart.length === 0) {
      Alert.alert('Carrito vacio', 'Agrega productos antes de hacer pedido.');
      return;
    }

    const safeLocation = fulfillmentMethod === 'DELIVERY'
      ? deliveryLocation ?? (await requestDeliveryLocation())
      : null;

    if (fulfillmentMethod === 'DELIVERY' && !safeLocation) {
      return;
    }

    if (fulfillmentMethod === 'DELIVERY' && !deliveryAddress.trim()) {
      Alert.alert('Direccion requerida', 'Confirma una referencia de entrega.');
      return;
    }

    if (minimumIssues.length) {
      Alert.alert('Pedido minimo', minimumIssues.join('\n'));
      return;
    }

    if (paymentMethod === 'CASH' && !acceptsCash) {
      Alert.alert('Efectivo no disponible', 'Uno de los negocios no acepta pago en efectivo.');
      return;
    }

    if (paymentMethod === 'CARD' && !acceptsCard) {
      Alert.alert('Tarjeta no disponible', 'Uno de los negocios no acepta pago con tarjeta.');
      return;
    }

    if (paymentMethod === 'CARD' && !meetsCardMinimum) {
      Alert.alert(
        'Pago en efectivo',
        `Los pedidos menores a $${cardMinimum.toFixed(2)} se pagan en efectivo.`
      );
      return;
    }

    if (fulfillmentMethod === 'DELIVERY') {
      Alert.alert(
        'Confirmar direccion',
        `Enviar este pedido a:\n\n${deliveryAddress.trim()}`,
        [
          { text: 'Cambiar direccion', style: 'cancel' },
          {
            text: 'Confirmar',
            onPress: () => {
              void submitCheckout(safeLocation);
            },
          },
        ]
      );
      return;
    }

    void submitCheckout(null);
  };

  const renderEmptyCart = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>Tu carrito esta vacio</Text>
      <PrimaryButton
        label="Ir a comprar"
        onPress={() => navigation.navigate('Home')}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Carrito" onBackPress={() => navigation.goBack()} />

      {cart.length === 0 ? (
        renderEmptyCart()
      ) : (
        <View style={styles.content}>
          <FlatList
            data={cart}
            keyExtractor={(item) => item.product.id}
            renderItem={({ item }) => (
              <View style={styles.cartItem}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.product.name}</Text>
                  <Text style={styles.itemQuantity}>Cantidad: {item.quantity}</Text>
                  <Text style={styles.itemQuantity}>
                    ${(item.product.priceCents * item.quantity / 100).toFixed(2)}
                  </Text>
                </View>
              </View>
            )}
          />

          <Text style={styles.inputLabel}>Forma de entrega</Text>
          <View style={styles.paymentMethodRow}>
            <Pressable
              onPress={() => setFulfillmentMethod('DELIVERY')}
              style={[
                styles.paymentMethodOption,
                fulfillmentMethod === 'DELIVERY' && styles.paymentMethodOptionActive,
              ]}
            >
              <Text style={[styles.paymentMethodText, fulfillmentMethod === 'DELIVERY' && styles.paymentMethodTextActive]}>
                Envio
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setFulfillmentMethod('PICKUP')}
              style={[
                styles.paymentMethodOption,
                fulfillmentMethod === 'PICKUP' && styles.paymentMethodOptionActive,
              ]}
            >
              <Text style={[styles.paymentMethodText, fulfillmentMethod === 'PICKUP' && styles.paymentMethodTextActive]}>
                Recoger
              </Text>
            </Pressable>
          </View>

          {fulfillmentMethod === 'DELIVERY' ? (
            <>
              <Text style={styles.inputLabel}>Direccion de entrega</Text>
              <TextInput
                value={deliveryAddress}
                onChangeText={setDeliveryAddress}
                placeholder="Referencia de entrega"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
              />
              <PrimaryButton
                disabled={isLocating || isProcessing}
                label={isLocating ? 'Obteniendo ubicacion...' : 'Usar ubicacion GPS segura'}
                onPress={requestDeliveryLocation}
                variant="secondary"
              />
              {deliveryLocation ? (
                <Text style={styles.locationText}>
                  Ubicacion lista: {deliveryAddress.trim() || 'Direccion confirmada'}
                </Text>
              ) : (
                <Text style={styles.locationHint}>
                  Tu ubicacion se usa para esta entrega y solo la vera el repartidor asignado.
                </Text>
              )}
            </>
          ) : (
            <Text style={styles.locationHint}>
              Te avisaremos cuando el negocio marque tu pedido como listo para recoger.
            </Text>
          )}

          <View style={styles.summary}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryTitle}>Resumen de pago</Text>
              <Text style={styles.summarySubtitle}>{cart.length} producto{cart.length === 1 ? '' : 's'}</Text>
            </View>
            <View style={styles.breakdownBox}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal de productos</Text>
                <Text style={styles.summaryValue}>${subtotal.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  {fulfillmentMethod === 'DELIVERY' ? 'Envio' : 'Recoger en negocio'}
                </Text>
                <Text style={styles.summaryValue}>${deliveryFee.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.totalRow}>
                <View style={styles.totalTextBlock}>
                  <Text style={styles.totalLabel}>Total a pagar</Text>
                  <Text style={styles.totalHint}>
                    {paymentMethod === 'CASH'
                      ? fulfillmentMethod === 'PICKUP'
                        ? 'Se cobra al recoger el pedido'
                        : 'Se cobra al recibir el pedido'
                      : 'Se paga con Stripe al confirmar'}
                  </Text>
                </View>
                <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
              </View>
            </View>

            <Text style={styles.inputLabel}>Forma de pago</Text>
            <View style={styles.paymentMethodRow}>
              <Pressable
                disabled={!cardAvailable}
                onPress={() => setPaymentMethod('CARD')}
                style={[
                  styles.paymentMethodOption,
                  paymentMethod === 'CARD' && styles.paymentMethodOptionActive,
                  !cardAvailable && styles.paymentMethodOptionDisabled,
                ]}
              >
                <Text style={[styles.paymentMethodText, paymentMethod === 'CARD' && styles.paymentMethodTextActive]}>
                  Tarjeta
                </Text>
              </Pressable>
              <Pressable
                disabled={!acceptsCash}
                onPress={() => setPaymentMethod('CASH')}
                style={[
                  styles.paymentMethodOption,
                  paymentMethod === 'CASH' && styles.paymentMethodOptionActive,
                  !acceptsCash && styles.paymentMethodOptionDisabled,
                ]}
              >
                <Text style={[styles.paymentMethodText, paymentMethod === 'CASH' && styles.paymentMethodTextActive]}>
                  Efectivo
                </Text>
              </Pressable>
            </View>
            {paymentMethod === 'CASH' ? (
              <Text style={styles.locationHint}>
                {fulfillmentMethod === 'PICKUP'
                  ? 'Pagaras en efectivo directamente al negocio cuando recojas tu pedido.'
                  : 'El repartidor cobrara el total al entregar y registrara el cambio entregado.'}
              </Text>
            ) : null}
            {!meetsCardMinimum ? (
              <Text style={styles.locationHint}>
                Tarjeta disponible desde ${cardMinimum.toFixed(2)} en productos. Pedidos menores se pagan en efectivo.
              </Text>
            ) : null}
            {minimumIssues.map((issue) => (
              <Text key={issue} style={styles.minimumIssue}>
                {issue}
              </Text>
            ))}

            <PrimaryButton
              disabled={
                isProcessing ||
                minimumIssues.length > 0 ||
                (paymentMethod === 'CASH' && !acceptsCash) ||
                (paymentMethod === 'CARD' && !cardAvailable)
              }
              label={isProcessing ? 'Enviando pedido...' : 'Hacer Pedido'}
              onPress={handleCheckout}
            />
          </View>
        </View>
      )}
      <CustomerTabBar active="cart" navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
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
  summary: {
    borderTopWidth: 2,
    borderTopColor: colors.border,
    paddingVertical: 16,
    marginBottom: 16,
  },
  summaryHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  summarySubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  breakdownBox: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    padding: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginBottom: 9,
  },
  summaryLabel: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '800',
  },
  summaryDivider: {
    backgroundColor: colors.border,
    height: 1,
    marginBottom: 10,
    marginTop: 2,
  },
  totalRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  totalTextBlock: {
    flex: 1,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  totalHint: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.primary,
  },
  inputLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 8,
  },
  input: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  locationText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
  },
  locationHint: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  paymentMethodRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  paymentMethodOption: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 12,
  },
  paymentMethodOptionActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  paymentMethodOptionDisabled: {
    opacity: 0.45,
  },
  paymentMethodText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '800',
  },
  paymentMethodTextActive: {
    color: colors.primary,
  },
  minimumIssue: {
    color: colors.dangerText,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
  },
});

function isInsideServiceaddress(latitude: number, longitude: number) {
  const distanceKm = getDistanceKm(
    VEGA_SERVICE_address.latitude,
    VEGA_SERVICE_address.longitude,
    latitude,
    longitude
  );
  return distanceKm <= 35;
}

function getDistanceKm(
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number
) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(toLatitude - fromLatitude);
  const dLon = toRadians(toLongitude - fromLongitude);
  const lat1 = toRadians(fromLatitude);
  const lat2 = toRadians(toLatitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
