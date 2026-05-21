import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  SafeAreaView,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Header from '../components/Header';
import ProductCard from '../components/ProductCard';
import { StateView } from '../components/StateView';
import { colors } from '../theme/colors';
import { businessApi } from '../services/businessApi';
import { useCart } from '../context/CartContext';
import type { Product } from '../types/business';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Products'>;

export default function ProductsScreen({ navigation, route }: Props) {
  const { businessId } = route.params;
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProducts();
  }, [businessId]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await businessApi.getBusinessProducts(businessId);
      setProducts(data);
    } catch (error) {
      console.error('Error loading products:', error);
      setError(error instanceof Error ? error.message : 'No se pudo cargar los productos');
    } finally {
      setLoading(false);
    }
  };

  const { addToCart } = useCart();

  const handleAddToCart = (product: Product, quantity: number) => {
    addToCart(product, quantity);
    Alert.alert(
      'Agregado al carrito',
      `${quantity} x ${product.name}`,
      [
        {
          text: 'Continuar comprando',
          onPress: () => {},
        },
        {
          text: 'Ver carrito',
          onPress: () => navigation.navigate('Cart'),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Productos" onBackPress={() => navigation.goBack()} />

      {loading ? (
        <StateView title="Cargando productos" message="Estamos consultando el menu del negocio." type="loading" />
      ) : error ? (
        <StateView
          actionLabel="Reintentar"
          message={error}
          onAction={loadProducts}
          title={error.includes('Sin conexion') ? 'Sin conexion' : 'No pudimos cargar el menu'}
          type="error"
        />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <StateView
              message="El negocio aun no ha publicado productos para ordenar."
              title="Negocio sin productos"
            />
          }
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              onAddToCart={handleAddToCart}
            />
          )}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    flexGrow: 1,
    padding: 16,
  },
});
