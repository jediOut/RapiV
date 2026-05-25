import { useEffect, useMemo, useState } from "react";
import { Alert, Linking, ScrollView, Text, View } from "react-native";

import { Header } from "../../components/Header";
import { StateView } from "../../components/StateView";
import { TabBar } from "../../components/TabBar";

import {
  createBusiness,
  createBusinessProduct,
  createStripeOnboardingLink,
  fetchBusinessProducts,
  fetchMyBusinesses,
  refreshStripeConnectStatus,
  updateBusiness,
  updateBusinessProduct,
  updateProductAvailability
} from "../../services/businessApi";
import { createMediaUploadUrl, uploadImageToS3 } from "../../services/mediaApi";
import type { ImagePickerAsset } from "expo-image-picker";

import {
  fetchBusinessOrders,
  updateBusinessOrderStatus
} from "../../services/orderApi";

import type { AuthSession } from "../../types/auth";

import type {
  Business,
  BusinessOrder,
  CreateProductPayload,
  Product
} from "../../types/business";

import type {
  BusinessScreen,
} from "../../types/navigation";

import { BusinessProfileRequiredScreen } from "../BusinessProfileRequiredScreen";
import { HomeScreen } from "../HomeScreen";
import { MenuScreen } from "../MenuScreen";
import { OrdersScreen } from "../OrdersScreen";
import { SettingsScreen } from "../SettingsScreen";
import { styles } from "./BusinessApp.styles";
import { businessTabs, toFiniteNumber } from "./BusinessApp.logic";

type BusinessAppProps = {
  session: AuthSession;
  onLogout: () => void;
};

export function BusinessApp({
  session,
  onLogout
}: BusinessAppProps) {
  const [screen, setScreen] =
    useState<BusinessScreen>("home");

  const [isOpen, setIsOpen] =
    useState(true);

  const [
    selectedBusiness,
    setSelectedBusiness
  ] = useState<Business | null>(
    null
  );

  const [products, setProducts] =
    useState<Product[]>([]);

  const [orders, setOrders] =
    useState<BusinessOrder[]>([]);

  const [prepTime, setPrepTime] =
    useState("25");

  const [
    isLoadingProducts,
    setIsLoadingProducts
  ] = useState(true);

  const [
    isLoadingOrders,
    setIsLoadingOrders
  ] = useState(true);

  const [
    isMutatingProduct,
    setIsMutatingProduct
  ] = useState(false);

  const [
    isCreatingBusiness,
    setIsCreatingBusiness
  ] = useState(false);

  const [
    isUpdatingBusiness,
    setIsUpdatingBusiness
  ] = useState(false);

  const [businessError, setBusinessError] =
    useState<string | null>(null);

  const businessProfile = {
    name:
      selectedBusiness?.name ||
      "Mi Negocio",

    id:
      selectedBusiness?.id,

    logo:
      selectedBusiness?.logo,

    address:
      selectedBusiness?.address ||
      "",

    acceptsCash:
      selectedBusiness?.acceptsCash ?? true,

    acceptsCard:
      selectedBusiness?.acceptsCard ?? true,

    stripeConnectedAccountId:
      selectedBusiness?.stripeConnectedAccountId,

    stripeChargesEnabled:
      selectedBusiness?.stripeChargesEnabled ?? false,

    stripePayoutsEnabled:
      selectedBusiness?.stripePayoutsEnabled ?? false,

    stripeDetailsSubmitted:
      selectedBusiness?.stripeDetailsSubmitted ?? false,

    stripeRequirementsCurrentlyDue:
      selectedBusiness?.stripeRequirementsCurrentlyDue ?? null,

    minimumOrderItems:
      selectedBusiness?.minimumOrderItems ?? 1,

    alertsEnabled: true,

    coordinates: {
      latitude:
        toFiniteNumber(selectedBusiness?.latitude, 20.0287),

      longitude:
        toFiniteNumber(selectedBusiness?.longitude, -96.6473)
    }
  };

  const activeOrders = orders.filter(
    (order) =>
      !["DELIVERED", "REJECTED", "CANCELLED"].includes(order.status)
  ).length;

  const availableProducts =
    products.filter(
      (product) => product.available
    ).length;

  const salesTotal = useMemo(
    () =>
      orders.reduce(
        (sum, order) =>
          sum +
          order.subtotalCents / 100,
        0
      ),
    [orders]
  );

  useEffect(() => {
    async function loadBusinessData() {
      setIsLoadingProducts(true);
      setIsLoadingOrders(true);

      setBusinessError(null);

      try {
        const nextBusinesses =
          await fetchMyBusinesses(
            session.accessToken
          );

        const business =
          nextBusinesses[0] ?? null;

        setSelectedBusiness(
          business
        );

        setIsOpen(
          business?.isOpen ?? true
        );

        if (!business) {
          setProducts([]);
          setOrders([]);
          return;
        }

        const [
          businessProducts,
          businessOrders
        ] = await Promise.all([
          fetchBusinessProducts(
            session.accessToken,
            business.id
          ),

          fetchBusinessOrders(
            session.accessToken,
            business.id
          )
        ]);

        setProducts(
          businessProducts
        );

        setOrders(
          businessOrders
        );
      } catch (error) {
        setBusinessError(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los datos"
        );
      } finally {
        setIsLoadingProducts(
          false
        );

        setIsLoadingOrders(
          false
        );
      }
    }

    void loadBusinessData();
  }, [session.accessToken]);

  async function handleCreateBusiness(
    payload: {
      name: string;
      address: string;
      latitude?: number;
      longitude?: number;
    }
  ) {
    if (
      !payload.name.trim() ||
      !payload.address.trim()
    ) {
      setBusinessError(
        "Nombre y dirección son obligatorios"
      );

      return;
    }

    if (
      payload.latitude ===
        undefined ||
      payload.longitude ===
        undefined
    ) {
      setBusinessError(
        "Selecciona una ubicación"
      );

      return;
    }

    setIsCreatingBusiness(true);

    setBusinessError(null);

    try {
      const business =
        await createBusiness(
          session.accessToken,
          payload
        );

      setSelectedBusiness(
        business
      );

      setProducts([]);

      setOrders([]);

      setScreen("menu");
    } catch (error) {
      setBusinessError(
        error instanceof Error
          ? error.message
          : "No se pudo crear el negocio"
      );
    } finally {
      setIsCreatingBusiness(
        false
      );
    }
  }

  async function handleUpdateBusiness(
    payload: any
  ) {
    if (!selectedBusiness) {
      return;
    }

    try {
      setIsUpdatingBusiness(
        true
      );

      setBusinessError(null);

      const updatedBusiness =
        await updateBusiness(
          session.accessToken,
          selectedBusiness.id,
          {
            name: payload.name,

            address:
              payload.address,

            latitude:
              toFiniteNumber(payload.coordinates?.latitude, selectedBusiness.latitude ?? 20.0287),

            longitude:
              toFiniteNumber(payload.coordinates?.longitude, selectedBusiness.longitude ?? -96.6473),

            logo:
              payload.logo,

            acceptsCash:
              payload.acceptsCash,

            acceptsCard:
              payload.acceptsCard,

            minimumOrderItems:
              payload.minimumOrderItems
          }
        );

      setSelectedBusiness(
        updatedBusiness
      );

      Alert.alert(
        "Éxito",
        "Negocio actualizado correctamente"
      );
    } catch (error) {
      console.log(error);

      setBusinessError(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar"
      );

      Alert.alert(
        "Error",
        "No se pudo actualizar el negocio"
      );
    } finally {
      setIsUpdatingBusiness(
        false
      );
    }
  }

  async function handleConnectStripe() {
    if (!selectedBusiness) {
      return;
    }

    try {
      setIsUpdatingBusiness(true);
      setBusinessError(null);

      const response = await createStripeOnboardingLink(
        session.accessToken,
        selectedBusiness.id
      );

      setSelectedBusiness(response.business);

      const canOpen = await Linking.canOpenURL(response.url);

      if (!canOpen) {
        throw new Error("No se pudo abrir Stripe en este dispositivo");
      }

      await Linking.openURL(response.url);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "No se pudo iniciar la configuracion de Stripe";

      setBusinessError(message);
      Alert.alert("Stripe Connect", message);
    } finally {
      setIsUpdatingBusiness(false);
    }
  }

  async function handleRefreshStripeStatus() {
    if (!selectedBusiness) {
      return;
    }

    try {
      setIsUpdatingBusiness(true);
      setBusinessError(null);

      const updatedBusiness = await refreshStripeConnectStatus(
        session.accessToken,
        selectedBusiness.id
      );

      setSelectedBusiness(updatedBusiness);

      Alert.alert(
        "Stripe Connect",
        updatedBusiness.stripeChargesEnabled
          ? "Tu negocio ya puede aceptar pagos con tarjeta."
          : "Tu configuracion de Stripe aun esta pendiente."
      );
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "No se pudo actualizar el estado de Stripe";

      setBusinessError(message);
      Alert.alert("Stripe Connect", message);
    } finally {
      setIsUpdatingBusiness(false);
    }
  }

  async function handleToggleOpen(nextIsOpen: boolean) {
    if (!selectedBusiness) {
      setIsOpen(nextIsOpen);
      return;
    }

    const previousIsOpen = isOpen;
    setIsOpen(nextIsOpen);

    try {
      const updatedBusiness = await updateBusiness(
        session.accessToken,
        selectedBusiness.id,
        { isOpen: nextIsOpen }
      );

      setSelectedBusiness(updatedBusiness);
    } catch (error) {
      setIsOpen(previousIsOpen);
      setBusinessError(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el estado del negocio"
      );
    }
  }

  async function loadBusinessOrders(
    businessId: string
  ) {
    try {
      setIsLoadingOrders(true);

      const businessOrders =
        await fetchBusinessOrders(
          session.accessToken,
          businessId
        );

      setOrders(
        businessOrders
      );
    } catch (error) {
      setBusinessError(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar pedidos"
      );
    } finally {
      setIsLoadingOrders(
        false
      );
    }
  }

  async function toggleProduct(
    id: string
  ) {
    if (!selectedBusiness) {
      return;
    }

    const product =
      products.find(
        (candidate) =>
          candidate.id === id
      );

    if (!product) {
      return;
    }

    setIsMutatingProduct(true);

    setBusinessError(null);

    try {
      const updatedProduct =
        await updateProductAvailability(
          session.accessToken,
          selectedBusiness.id,
          product.id,
          !product.available
        );

      setProducts((current) =>
        current.map((candidate) =>
          candidate.id ===
          updatedProduct.id
            ? updatedProduct
            : candidate
        )
      );
    } catch (error) {
      setBusinessError(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el producto"
      );
    } finally {
      setIsMutatingProduct(
        false
      );
    }
  }

  async function handleCreateProduct(
    payload: CreateProductPayload,
    imageAsset?: ImagePickerAsset
  ) {
    if (!selectedBusiness) {
      return;
    }

    setIsMutatingProduct(true);

    setBusinessError(null);

    try {
      let imageUrl: string | undefined;

      if (imageAsset) {
        const contentType = imageAsset.mimeType;

        if (
          contentType !== "image/jpeg" &&
          contentType !== "image/png" &&
          contentType !== "image/webp"
        ) {
          throw new Error("Usa una imagen JPG, PNG o WebP");
        }

        const upload = await createMediaUploadUrl(session.accessToken, {
          targetType: "product-image",
          targetId: selectedBusiness.id,
          contentType
        });

        await uploadImageToS3(upload.uploadUrl, imageAsset.uri, contentType);
        imageUrl = upload.publicUrl;
      }

      const product =
        await createBusinessProduct(
          session.accessToken,
          selectedBusiness.id,
          {
            ...payload,
            image: imageUrl
          }
        );

      setProducts((current) => [
        ...current,
        product
      ]);
    } catch (error) {
      setBusinessError(
        error instanceof Error
          ? error.message
          : "No se pudo crear producto"
      );
    } finally {
      setIsMutatingProduct(
        false
      );
    }
  }

  async function handleUpdateProduct(
    product: Product,
    payload: Partial<CreateProductPayload>,
    imageAsset?: ImagePickerAsset
  ) {
    if (!selectedBusiness) {
      return;
    }

    setIsMutatingProduct(true);
    setBusinessError(null);

    try {
      let imageUrl = payload.image;

      if (imageAsset) {
        const contentType = imageAsset.mimeType;

        if (
          contentType !== "image/jpeg" &&
          contentType !== "image/png" &&
          contentType !== "image/webp"
        ) {
          throw new Error("Usa una imagen JPG, PNG o WebP");
        }

        const upload = await createMediaUploadUrl(session.accessToken, {
          targetType: "product-image",
          targetId: product.id,
          contentType
        });

        await uploadImageToS3(upload.uploadUrl, imageAsset.uri, contentType);
        imageUrl = upload.publicUrl;
      }

      const updatedProduct = await updateBusinessProduct(
        session.accessToken,
        selectedBusiness.id,
        product.id,
        {
          ...payload,
          image: imageUrl
        }
      );

      setProducts((current) =>
        current.map((candidate) =>
          candidate.id === updatedProduct.id ? updatedProduct : candidate
        )
      );
    } catch (error) {
      setBusinessError(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar producto"
      );
    } finally {
      setIsMutatingProduct(false);
    }
  }

  async function handleUploadBusinessLogo(imageAsset: ImagePickerAsset) {
    if (!selectedBusiness) {
      return;
    }

    setIsUpdatingBusiness(true);
    setBusinessError(null);

    try {
      const contentType = imageAsset.mimeType;

      if (
        contentType !== "image/jpeg" &&
        contentType !== "image/png" &&
        contentType !== "image/webp"
      ) {
        throw new Error("Usa una imagen JPG, PNG o WebP");
      }

      const upload = await createMediaUploadUrl(session.accessToken, {
        targetType: "business-logo",
        targetId: selectedBusiness.id,
        contentType
      });

      await uploadImageToS3(upload.uploadUrl, imageAsset.uri, contentType);

      const updatedBusiness = await updateBusiness(
        session.accessToken,
        selectedBusiness.id,
        { logo: upload.publicUrl }
      );

      setSelectedBusiness(updatedBusiness);
    } catch (error) {
      setBusinessError(
        error instanceof Error
          ? error.message
          : "No se pudo subir el logo"
      );
    } finally {
      setIsUpdatingBusiness(false);
    }
  }

  async function handleUpdateOrderStatus(
    order: BusinessOrder,
    nextStatus:
      | "ACCEPTED"
      | "PREPARING"
      | "READY"
      | "REJECTED"
  ) {
    if (!selectedBusiness) {
      return;
    }

    try {
      await updateBusinessOrderStatus(
        session.accessToken,
        selectedBusiness.id,
        order.id,
        nextStatus
      );

      await loadBusinessOrders(
        selectedBusiness.id
      );
    } catch (error) {
      setBusinessError(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar pedido"
      );
    }
  }

  const displayedBusinessName =
    businessProfile.name;

  if (!selectedBusiness && isLoadingProducts) {
    return (
      <View style={styles.appShell}>
        <StateView
          message="Estamos restaurando tu negocio, productos y pedidos."
          title="Cargando negocio"
          type="loading"
        />
      </View>
    );
  }

  if (
    !selectedBusiness &&
    !isLoadingProducts
  ) {
    const roles =
      session.user.roles ?? [];

    const profileName =
      roles.includes("COURIER")
        ? "repartidor"
        : roles.includes(
              "CUSTOMER"
            )
          ? "cliente"
          : "otro tipo";

    return (
      <BusinessProfileRequiredScreen
        error={businessError}
        isLoading={
          isCreatingBusiness
        }
        profileName={
          profileName
        }
        onCreateBusiness={
          handleCreateBusiness
        }
        onLogout={onLogout}
      />
    );
  }

  return (
    <View style={styles.appShell}>
      <Header
        businessName={
          displayedBusinessName
        }
        isOpen={isOpen}
        onLogout={onLogout}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={
          styles.contentInner
        }
      >
        {screen === "home" && (
          <HomeScreen
            activeOrders={
              activeOrders
            }
            availableProducts={
              availableProducts
            }
            isOpen={isOpen}
            orders={orders}
            prepTime={prepTime}
            salesTotal={
              salesTotal
            }
            setIsOpen={
              handleToggleOpen
            }
          />
        )}

        {screen === "orders" && (
          <OrdersScreen
            error={businessError}
            isLoading={
              isLoadingOrders
            }
            onRetry={() => {
              if (selectedBusiness) {
                void loadBusinessOrders(selectedBusiness.id);
              }
            }}
            orders={orders}
            onUpdateStatus={
              handleUpdateOrderStatus
            }
          />
        )}

        {screen === "menu" && (
          <MenuScreen
            error={businessError}
            isLoading={
              isLoadingProducts
            }
            isMutatingProduct={
              isMutatingProduct
            }
            onCreateProduct={
              handleCreateProduct
            }
            onPrepTimeChange={
              setPrepTime
            }
            onToggleProduct={
              toggleProduct
            }
            onUpdateProduct={
              handleUpdateProduct
            }
            prepTime={prepTime}
            products={products}
          />
        )}

        {screen ===
          "settings" && (
          <SettingsScreen
            businessProfile={
              businessProfile
            }
            isLoading={
              isUpdatingBusiness
            }
            onSave={
              handleUpdateBusiness
            }
            onConnectStripe={
              handleConnectStripe
            }
            onRefreshStripeStatus={
              handleRefreshStripeStatus
            }
            onUploadLogo={
              handleUploadBusinessLogo
            }
          />
        )}
      </ScrollView>

      <TabBar
        activeScreen={screen}
        onChange={setScreen}
        tabs={businessTabs}
      />
    </View>
  );
}
