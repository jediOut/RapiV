import React, { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  SafeAreaView,
  Text,
  Alert,
  TextInput,
} from 'react-native';
import * as Location from 'expo-location';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Header from '../components/Header';
import { CustomerTabBar } from '../components/CustomerTabBar';
import { colors } from '../theme/colors';
import { useCart } from '../context/CartContext';
import { orderApi } from '../services/orderApi';
import { RootStackParamList } from '../types/navigation';
import { PrimaryButton } from '../components/PrimaryButton';
import { VEGA_SERVICE_address } from '../config/serviceZone';
import { resolveAddressFromCoordinates } from '../utils/locationAddress';

type Props = NativeStackScreenProps<RootStackParamList, 'Cart'>;

export default function CartScreen({ navigation }: Props) {
  const { cart, subtotalCents, removeFromCart, updateQuantity, clearCart } = useCart();
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const isSubmittingRef = useRef(false);
  const checkoutIdempotencyKeyRef = useRef<string | null>(null);

  const total = subtotalCents / 100;

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
      Alert.alert('Error de ubicacion', 'No se pudo obtener la ubicacion del telefono');
      return null;
    } finally {
      setIsLocating(false);
    }
  };

  const handleCheckout = async () => {
    if (isSubmittingRef.current) {
      return;
    }

    if (cart.length === 0) {
      Alert.alert('Carrito vacío', 'Agrega productos antes de hacer pedido');
      return;
    }

    const safeLocation = deliveryLocation ?? (await requestDeliveryLocation());

    if (!safeLocation) {
      return;
    }

    if (!deliveryAddress.trim()) {
      Alert.alert('Direccion requerida', 'Confirma una referencia de entrega');
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
          deliveryAddress: deliveryAddress.trim(),
          latitude: safeLocation.latitude,
          longitude: safeLocation.longitude,
          items: cart.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity
          }))
        },
        checkoutIdempotencyKeyRef.current
      );
      clearCart();
      checkoutIdempotencyKeyRef.current = null;
      Alert.alert('Pedido creado', 'Tu pedido fue enviado al negocio.');
      navigation.navigate('OrderDetail', { orderId: order.id });
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo crear el pedido');
    } finally {
      isSubmittingRef.current = false;
      setIsProcessing(false);
    }
  };

  const renderEmptyCart = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>Tu carrito está vacío</Text>
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

          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal:</Text>
              <Text style={styles.summaryValue}>${total.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Envío:</Text>
              <Text style={styles.summaryValue}>$5.00</Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total:</Text>
              <Text style={styles.totalValue}>
                ${(total + 5).toFixed(2)}
              </Text>
            </View>

            <PrimaryButton
              disabled={isProcessing}
              label={isProcessing ? "Enviando pedido..." : "Hacer Pedido"}
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
  emptyButton: {
    width: 200,
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
  itemPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  summary: {
    borderTopWidth: 2,
    borderTopColor: colors.border,
    paddingVertical: 16,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 13,
    color: colors.text,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    marginTop: 8,
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
  checkoutButton: {
    marginTop: 16,
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
