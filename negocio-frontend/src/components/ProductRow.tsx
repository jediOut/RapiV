import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { colors } from "../theme/colors";
import type { Product } from "../types/business";

type ProductRowProps = {
  product: Product;
  onEdit: (product: Product) => void;
  onToggle: (id: string) => void;
  canPublishProducts?: boolean;
  disabled?: boolean;
};

export function ProductRow({
  product,
  onEdit,
  onToggle,
  canPublishProducts = true,
  disabled = false
}: ProductRowProps) {
  const needsStripeToPublish = !product.available && !canPublishProducts;

  return (
    <View style={styles.productRow}>
      {product.image ? (
        <Image source={{ uri: product.image }} style={styles.productImage} />
      ) : (
        <View style={styles.productIcon}>
          <Ionicons name="restaurant" size={18} color={colors.primary} />
        </View>
      )}
      <View style={styles.productInfo}>
        <Text style={styles.itemTitle}>{product.name}</Text>
        <Text style={styles.mutedText}>
          {product.category} - ${(product.priceCents / 100).toFixed(2)}
        </Text>
        <Text style={styles.mutedText}>
          Mínimo por pedido: {product.minimumQuantityPerOrder ?? 1}
        </Text>
        {product.description ? (
          <Text numberOfLines={2} style={styles.descriptionText}>
            {product.description}
          </Text>
        ) : null}
        <Text style={[styles.availabilityText, product.available ? styles.availableText : styles.pausedText]}>
          {product.available ? "Visible para clientes" : "Pausado"}
        </Text>
        {needsStripeToPublish ? (
          <Text style={styles.publishBlockedText}>
            Conecta Stripe para publicar
          </Text>
        ) : null}
      </View>
      <Pressable
        disabled={disabled}
        onPress={() => onEdit(product)}
        style={styles.editButton}
      >
        <Ionicons name="create-outline" size={18} color={colors.primary} />
      </Pressable>
      <Switch
        disabled={disabled}
        onValueChange={() => onToggle(product.id)}
        thumbColor={product.available ? colors.primary : colors.muted}
        trackColor={{ false: colors.disabled, true: colors.primaryBorder }}
        value={product.available}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  productRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingVertical: 13
  },
  productIcon: {
    alignItems: "center",
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    height: 38,
    justifyContent: "center",
    width: 38
  },
  productImage: {
    borderRadius: 8,
    height: 44,
    width: 44
  },
  productInfo: {
    flex: 1
  },
  editButton: {
    alignItems: "center",
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryBorder,
    borderRadius: 8,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38
  },
  itemTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0
  },
  mutedText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18
  },
  descriptionText: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2
  },
  availabilityText: {
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2
  },
  availableText: {
    color: colors.primary
  },
  pausedText: {
    color: colors.muted
  },
  publishBlockedText: {
    color: "#B45309",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2
  }
});
