import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  SafeAreaView,
  Alert,
  Text,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Header from '../../components/Header';
import ProductCard from '../../components/ProductCard';
import { StateView } from '../../components/StateView';
import { colors } from '../../theme/colors';
import { businessApi } from '../../services/businessApi';
import { useCart } from '../../context/CartContext';
import type { Business, Product } from '../../types/business';
import type { RootStackParamList } from '../../types/navigation';
import { ratingApi } from '../../services/ratingApi';
import type { Rating, RatingSummary } from '@rapidin/contracts';

type Props = NativeStackScreenProps<RootStackParamList, 'Products'>;

export default function ProductsScreen({ navigation, route }: Props) {
  const { businessId } = route.params;
  const [business, setBusiness] = useState<Business | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [ratingSummary, setRatingSummary] = useState<RatingSummary>({ average: null, count: 0 });
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProducts();
  }, [businessId]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const [businessDetail, data, summary, targetRatings] = await Promise.all([
        businessApi.getBusinessDetail(businessId),
        businessApi.getBusinessProducts(businessId),
        ratingApi.getTargetSummary('BUSINESS', businessId),
        ratingApi.getTargetRatings('BUSINESS', businessId),
      ]);
      setBusiness(businessDetail);
      setProducts(data);
      setRatingSummary(summary);
      setRatings(targetRatings.slice(0, 3));
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
          ListHeaderComponent={
            business ? (
              <View style={styles.businessHeader}>
                <Text style={styles.businessName}>{business.name}</Text>
                <Text style={styles.businessDescription}>
                  {business.description || business.address || 'Productos disponibles para ordenar.'}
                </Text>
                <Text style={styles.businessRating}>
                  {ratingSummary.average ? `${ratingSummary.average.toFixed(1)} / 5` : 'Sin valoraciones'} - {ratingSummary.count} valoraciones
                </Text>
                {ratings.length ? (
                  <View style={styles.ratingPreview}>
                    {ratings.map((rating) => (
                      <Text key={rating.id} style={styles.ratingPreviewText}>
                        {rating.score}/5 {rating.comment ? `- ${rating.comment}` : ''}
                      </Text>
                    ))}
                  </View>
                ) : null}
                <Text style={styles.productsTitle}>Productos</Text>
              </View>
            ) : null
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
  businessHeader: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    padding: 16,
  },
  businessName: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  businessDescription: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  businessRating: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 10,
  },
  ratingPreview: {
    gap: 4,
    marginTop: 10,
  },
  ratingPreviewText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  productsTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
    marginTop: 14,
  },
});
