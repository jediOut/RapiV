import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { Product } from '../types/business';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product, quantity: number) => void;
}

export default function ProductCard({
  product,
  onAddToCart,
}: ProductCardProps) {
  const minimumQuantity = product.minimumQuantityPerOrder ?? 1;
  const [quantity, setQuantity] = useState(minimumQuantity);

  useEffect(() => {
    setQuantity(minimumQuantity);
  }, [minimumQuantity, product.id]);

  const handleAddToCart = () => {
    onAddToCart(product, quantity);
    setQuantity(minimumQuantity);
  };

  return (
    <View style={styles.card}>
      {product.image ? (
        <Image
          source={{ uri: product.image }}
          style={styles.image}
        />
      ) : (
        <View style={styles.imageFallback}>
          <MaterialIcons name="restaurant" size={28} color={colors.primary} />
        </View>
      )}
      <View style={styles.content}>
        <Text style={styles.name}>{product.name}</Text>
        {product.description && (
          <Text style={styles.description} numberOfLines={2}>
            {product.description}
          </Text>
        )}
        <Text style={styles.price}>${(product.priceCents / 100).toFixed(2)}</Text>
        {minimumQuantity > 1 ? (
          <Text style={styles.minimumText}>Minimo: {minimumQuantity}</Text>
        ) : null}

        {product.available ? (
          <View style={styles.quantityContainer}>
            <TouchableOpacity
              onPress={() => quantity > minimumQuantity && setQuantity(quantity - 1)}
              style={styles.quantityButton}
            >
              <MaterialIcons name="remove" size={18} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.quantity}>{quantity}</Text>
            <TouchableOpacity
              onPress={() => setQuantity(quantity + 1)}
              style={styles.quantityButton}
            >
              <MaterialIcons name="add" size={18} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleAddToCart}
              style={styles.addButton}
            >
              <MaterialIcons name="shopping-cart" size={18} color={colors.background} />
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.unavailable}>No disponible</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
  },
  image: {
    width: 112,
    height: 112,
    backgroundColor: colors.surface,
  },
  imageFallback: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    height: 112,
    justifyContent: 'center',
    width: 112,
  },
  content: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  name: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0,
  },
  description: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 4,
  },
  minimumText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 8,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantity: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unavailable: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
});
