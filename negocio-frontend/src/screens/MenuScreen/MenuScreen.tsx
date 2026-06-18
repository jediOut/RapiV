import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ProductRow } from "../../components/ProductRow";
import { PrimaryButton } from "../../components/PrimaryButton";
import { StateView } from "../../components/StateView";
import { colors } from "../../theme/colors";
import type { CreateProductPayload, Product, UpdateProductPayload } from "../../types/business";

type MenuScreenProps = {
  error: string | null;
  isLoading: boolean;
  isMutatingProduct: boolean;
  onCreateProduct: (
    payload: CreateProductPayload,
    imageAsset?: ImagePicker.ImagePickerAsset
  ) => void;
  onUpdateProduct: (
    product: Product,
    payload: UpdateProductPayload,
    imageAsset?: ImagePicker.ImagePickerAsset
  ) => void;
  onPrepTimeChange: (value: string) => void;
  onConnectStripe: () => void;
  onRefreshStripeStatus: () => void;
  onToggleProduct: (id: string) => void;
  canPublishProducts: boolean;
  hasStripeConnectAccount: boolean;
  prepTime: string;
  products: Product[];
};

export function MenuScreen({
  error,
  isLoading,
  isMutatingProduct,
  onCreateProduct,
  onUpdateProduct,
  onPrepTimeChange,
  onConnectStripe,
  onRefreshStripeStatus,
  onToggleProduct,
  canPublishProducts,
  hasStripeConnectAccount,
  prepTime,
  products
}: MenuScreenProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [minimumQuantity, setMinimumQuantity] = useState("1");
  const [imageAsset, setImageAsset] = useState<ImagePicker.ImagePickerAsset | undefined>();
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  async function pickProductImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [4, 3],
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85
    });

    if (!result.canceled) {
      setImageAsset(result.assets[0]);
    }
  }

  function resetProductForm() {
    setName("");
    setCategory("");
    setDescription("");
    setPrice("");
    setMinimumQuantity("1");
    setImageAsset(undefined);
    setEditingProduct(null);
  }

  function startEditProduct(product: Product) {
    setEditingProduct(product);
    setName(product.name);
    setCategory(product.category ?? "");
    setDescription(product.description ?? "");
    setPrice((product.priceCents / 100).toFixed(2));
    setMinimumQuantity(String(product.minimumQuantityPerOrder ?? 1));
    setImageAsset(undefined);
  }

  function handleSaveProduct() {
    if (!editingProduct && !canPublishProducts) {
      return;
    }

    const priceCents = Math.round(Number(price) * 100);
    const minimumQuantityPerOrder = Math.max(1, Math.floor(Number(minimumQuantity)));

    if (
      !name.trim() ||
      !category.trim() ||
      !Number.isFinite(priceCents) ||
      priceCents <= 0 ||
      !Number.isFinite(minimumQuantityPerOrder)
    ) {
      return;
    }

    const payload = {
      name: name.trim(),
      category: category.trim(),
      description: description.trim() || undefined,
      priceCents,
      minimumQuantityPerOrder
    };

    if (editingProduct) {
      onUpdateProduct(editingProduct, payload, imageAsset);
    } else {
      onCreateProduct(payload, imageAsset);
    }

    resetProductForm();
  }

  return (
    <View>
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Tiempo estimado</Text>
        <View style={styles.inputRow}>
          <Ionicons name="timer-outline" size={22} color={colors.primary} />
          <TextInput
            keyboardType="number-pad"
            maxLength={3}
            onChangeText={onPrepTimeChange}
            style={styles.input}
            value={prepTime}
          />
          <Text style={styles.inputSuffix}>minutos</Text>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Menú del negocio</Text>
        {!canPublishProducts ? (
          <View style={styles.stripeNotice}>
            <View style={styles.stripeNoticeIcon}>
              <Ionicons name="card-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.stripeNoticeContent}>
              <Text style={styles.stripeNoticeTitle}>
                Stripe Connect requerido
              </Text>
              <Text style={styles.stripeNoticeText}>
                Para publicar productos y recibir pagos, completa Stripe Connect en tu negocio.
              </Text>
              <View style={styles.stripeNoticeActions}>
                <Pressable
                  disabled={isMutatingProduct}
                  onPress={onConnectStripe}
                  style={styles.stripeNoticeButton}
                >
                  <Text style={styles.stripeNoticeButtonText}>
                    {hasStripeConnectAccount ? "Continuar Stripe" : "Configurar Stripe"}
                  </Text>
                </Pressable>
                <Pressable
                  disabled={isMutatingProduct || !hasStripeConnectAccount}
                  onPress={onRefreshStripeStatus}
                  style={[
                    styles.stripeNoticeButtonSecondary,
                    (!hasStripeConnectAccount || isMutatingProduct) && styles.stripeNoticeButtonDisabled
                  ]}
                >
                  <Text style={styles.stripeNoticeButtonSecondaryText}>
                    Actualizar estado
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}
        {isLoading ? (
          <StateView
            compact
            message="Estamos cargando los productos publicados."
            title="Cargando productos"
            type="loading"
          />
        ) : error ? (
          <StateView
            compact
            message={error}
            title={error.includes("Sin conexion") ? "Sin conexión" : "No pudimos cargar el menú"}
            type="error"
          />
        ) : products.length === 0 ? (
          <StateView
            compact
            message="Agrega tu primer producto para que los clientes puedan ordenar."
            title="Negocio sin productos"
          />
        ) : null}
        {!isLoading && !error ? products.map((product) => (
          <ProductRow
            key={product.id}
            canPublishProducts={canPublishProducts}
            disabled={isMutatingProduct}
            onEdit={startEditProduct}
            onToggle={onToggleProduct}
            product={product}
          />
        )) : null}
      </View>

      <View style={styles.panel}>
        <View style={styles.formHeader}>
          <Text style={styles.sectionTitle}>
            {editingProduct ? "Editar producto" : "Agregar producto"}
          </Text>
          {editingProduct ? (
            <PrimaryButton
              disabled={isMutatingProduct}
              label="Cancelar"
              onPress={resetProductForm}
              variant="secondary"
            />
          ) : null}
        </View>
        <TextInput
          onChangeText={setName}
          placeholder="Nombre"
          placeholderTextColor={colors.muted}
          style={styles.formInput}
          value={name}
        />
        <TextInput
          onChangeText={setCategory}
          placeholder="Categoria"
          placeholderTextColor={colors.muted}
          style={styles.formInput}
          value={category}
        />
        <TextInput
          multiline
          onChangeText={setDescription}
          placeholder="Descripcion corta"
          placeholderTextColor={colors.muted}
          style={[styles.formInput, styles.descriptionInput]}
          textAlignVertical="top"
          value={description}
        />
        <TextInput
          keyboardType="decimal-pad"
          onChangeText={setPrice}
          placeholder="Precio"
          placeholderTextColor={colors.muted}
          style={styles.formInput}
          value={price}
        />
        <TextInput
          keyboardType="number-pad"
          onChangeText={setMinimumQuantity}
          placeholder="Mínimo por pedido"
          placeholderTextColor={colors.muted}
          style={styles.formInput}
          value={minimumQuantity}
        />
        <View style={styles.imagePickerRow}>
          {imageAsset ? (
            <Image source={{ uri: imageAsset.uri }} style={styles.productPreview} />
          ) : editingProduct?.image ? (
            <Image source={{ uri: editingProduct.image }} style={styles.productPreview} />
          ) : (
            <View style={styles.productPreviewPlaceholder}>
              <Ionicons name="image-outline" size={28} color={colors.muted} />
            </View>
          )}
          <View style={styles.imagePickerContent}>
            <Text style={styles.imagePickerTitle}>Imagen del producto</Text>
            <Text style={styles.imagePickerHint}>JPG, PNG o WebP</Text>
          </View>
          <PrimaryButton
            disabled={isMutatingProduct}
            label={imageAsset ? "Cambiar" : "Elegir"}
            onPress={pickProductImage}
            variant="secondary"
          />
        </View>
        <PrimaryButton
          disabled={isMutatingProduct || (!editingProduct && !canPublishProducts)}
          label={
            isMutatingProduct
              ? "Guardando..."
              : editingProduct
                ? "Guardar cambios"
                : "Guardar producto"
          }
          onPress={handleSaveProduct}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    padding: 16
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0,
    marginBottom: 4
  },
  formHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    marginBottom: 10
  },
  inputRow: {
    alignItems: "center",
    borderColor: colors.disabled,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
    paddingHorizontal: 12
  },
  input: {
    color: colors.text,
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
    minHeight: 48
  },
  inputSuffix: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700"
  },
  formInput: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 12,
    minHeight: 48,
    paddingHorizontal: 12
  },
  descriptionInput: {
    minHeight: 84,
    paddingTop: 12
  },
  imagePickerRow: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
    padding: 10
  },
  imagePickerContent: {
    flex: 1
  },
  imagePickerTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800"
  },
  imagePickerHint: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2
  },
  productPreview: {
    borderRadius: 8,
    height: 58,
    width: 58
  },
  productPreviewPlaceholder: {
    alignItems: "center",
    backgroundColor: colors.background,
    borderRadius: 8,
    height: 58,
    justifyContent: "center",
    width: 58
  },
  stripeNotice: {
    alignItems: "flex-start",
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryBorder,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
    padding: 12
  },
  stripeNoticeIcon: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 8,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  stripeNoticeContent: {
    flex: 1
  },
  stripeNoticeTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900"
  },
  stripeNoticeText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 4
  },
  stripeNoticeActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10
  },
  stripeNoticeButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  stripeNoticeButtonText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: "900"
  },
  stripeNoticeButtonSecondary: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.primaryBorder,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  stripeNoticeButtonSecondaryText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900"
  },
  stripeNoticeButtonDisabled: {
    opacity: 0.5
  }
});
