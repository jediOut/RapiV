import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Switch, Text, View } from "react-native";

import { colors } from "../theme/colors";
import type { Product } from "../types/business";

type ProductRowProps = {
  product: Product;
  onToggle: (id: string) => void;
  disabled?: boolean;
};

export function ProductRow({ product, onToggle, disabled = false }: ProductRowProps) {
  return (
    <View style={styles.productRow}>
      <View style={styles.productIcon}>
        <Ionicons name="restaurant" size={18} color={colors.primary} />
      </View>
      <View style={styles.productInfo}>
        <Text style={styles.itemTitle}>{product.name}</Text>
        <Text style={styles.mutedText}>
          {product.category} - ${(product.priceCents / 100).toFixed(2)}
        </Text>
      </View>
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
  productInfo: {
    flex: 1
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
  }
});
