import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";

import MapView, {
  Marker,
  Region
} from "react-native-maps";

import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";

import { colors } from "../../theme/colors";
import { styles } from "./SettingsScreen.styles";
import {
  DEFAULT_COORDINATES,
  type Coordinates,
  isInsideServiceArea
} from "./SettingsScreen.logic";

type BusinessProfile = {
  id?: string;
  name?: string;
  logo?: string | null;
  address?: string;
  acceptsCash?: boolean;
  acceptsCard?: boolean;
  stripeConnectedAccountId?: string | null;
  stripeChargesEnabled?: boolean;
  stripePayoutsEnabled?: boolean;
  stripeDetailsSubmitted?: boolean;
  stripeRequirementsCurrentlyDue?: string[] | null;
  minimumOrderItems?: number;
  alertsEnabled?: boolean;
  coordinates?: Coordinates;
};

type UpdateBusinessPayload = {
  name: string;
  logo?: string;
  address: string;
  acceptsCash: boolean;
  acceptsCard: boolean;
  minimumOrderItems: number;
  alertsEnabled: boolean;
  coordinates: Coordinates;
};

type SettingsScreenProps = {
  businessProfile: BusinessProfile;
  isLoading: boolean;
  onUploadLogo: (imageAsset: ImagePicker.ImagePickerAsset) => void;
  onSave: (
    payload: UpdateBusinessPayload
  ) => void;
  onConnectStripe: () => void;
  onRefreshStripeStatus: () => void;
};

export function SettingsScreen({
  businessProfile,
  isLoading,
  onUploadLogo,
  onSave,
  onConnectStripe,
  onRefreshStripeStatus
}: SettingsScreenProps) {
  const mapRef = useRef<MapView | null>(
    null
  );

  const [name, setName] = useState(
    businessProfile.name ?? ""
  );

  const [address, setAddress] = useState(
    businessProfile.address ?? ""
  );

  const [logoPreview, setLogoPreview] = useState(
    businessProfile.logo ?? ""
  );
  const [showMapEditor, setShowMapEditor] = useState(false);

  const [acceptsCash, setAcceptsCash] = useState(businessProfile.acceptsCash ?? true);
  const [acceptsCard, setAcceptsCard] = useState(
    Boolean(
      businessProfile.acceptsCard &&
        businessProfile.stripeConnectedAccountId &&
        businessProfile.stripeChargesEnabled
    )
  );
  const [minimumOrderItems, setMinimumOrderItems] = useState(
    String(businessProfile.minimumOrderItems ?? 1)
  );

  const [alertsEnabled, setAlertsEnabled] =
    useState(
      businessProfile.alertsEnabled ?? true
    );

  const [coordinates, setCoordinates] =
    useState<Coordinates>(
      businessProfile.coordinates ??
        DEFAULT_COORDINATES
    );

  const [markerPosition, setMarkerPosition] =
    useState<Coordinates>(
      businessProfile.coordinates ??
        DEFAULT_COORDINATES
    );

  useEffect(() => {
    const nextCoordinates = businessProfile.coordinates ?? DEFAULT_COORDINATES;

    setName(businessProfile.name ?? "");
    setAddress(businessProfile.address ?? "");
    setLogoPreview(businessProfile.logo ?? "");
    setAcceptsCash(businessProfile.acceptsCash ?? true);
    setAcceptsCard(
      Boolean(
        businessProfile.acceptsCard &&
          businessProfile.stripeConnectedAccountId &&
          businessProfile.stripeChargesEnabled
      )
    );
    setMinimumOrderItems(String(businessProfile.minimumOrderItems ?? 1));
    setAlertsEnabled(businessProfile.alertsEnabled ?? true);
    setCoordinates(nextCoordinates);
    setMarkerPosition(nextCoordinates);
  }, [
    businessProfile.name,
    businessProfile.address,
    businessProfile.logo,
    businessProfile.acceptsCash,
    businessProfile.acceptsCard,
    businessProfile.stripeConnectedAccountId,
    businessProfile.stripeChargesEnabled,
    businessProfile.minimumOrderItems,
    businessProfile.alertsEnabled,
    businessProfile.coordinates?.latitude,
    businessProfile.coordinates?.longitude
  ]);

  const stripeReady = Boolean(
    businessProfile.stripeConnectedAccountId &&
      businessProfile.stripeChargesEnabled
  );

  const stripeStatusLabel = stripeReady
    ? "Listo para recibir pagos con tarjeta"
    : businessProfile.stripeConnectedAccountId
      ? "Configuracion pendiente en Stripe"
      : "Stripe Connect no configurado";

  const stripeStatusDescription = stripeReady
    ? "Puedes activar tarjeta como metodo de pago."
    : "Completa Stripe Connect para activar pagos con tarjeta. Los datos bancarios se capturan directamente en Stripe.";

  async function resolveAddress(
    latitude: number,
    longitude: number
  ) {
    try {
      const result =
        await Location.reverseGeocodeAsync({
          latitude,
          longitude
        });

      if (!result.length) {
        return "Dirección no disponible";
      }

      const place = result[0];

      return [
        place.street,
        place.streetNumber,
        place.district,
        place.city,
        place.region
      ]
        .filter(Boolean)
        .join(", ");
    } catch {
      return "Dirección no disponible";
    }
  }

  async function handleConfirmMarker() {
    const allowed =
      isInsideServiceArea(
        markerPosition.latitude,
        markerPosition.longitude
      );

    if (!allowed) {
      Alert.alert(
        "Zona no disponible",
        "La ubicación debe estar dentro de Vega de Alatorre."
      );

      return;
    }

    try {
      const selectedAddress =
        await resolveAddress(
          markerPosition.latitude,
          markerPosition.longitude
        );

      Alert.alert(
        "Confirmar ubicación",
        `¿Quieres usar esta dirección?\n\n${selectedAddress}`,
        [
          {
            text: "Cancelar",
            style: "cancel"
          },
          {
            text: "Aceptar",
            onPress: () => {
              setCoordinates(
                markerPosition
              );

              setAddress(
                selectedAddress
              );

              mapRef.current?.animateToRegion(
                {
                  latitude:
                    markerPosition.latitude,
                  longitude:
                    markerPosition.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01
                },
                600
              );
            }
          }
        ]
      );
    } catch {
      Alert.alert(
        "Error",
        "No se pudo obtener la dirección."
      );
    }
  }

  async function handlePickLogo() {
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Permiso denegado",
        "Debes permitir acceso a tus imagenes."
      );

      return;
    }

    const result =
      await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85
      });

    if (!result.canceled) {
      setLogoPreview(result.assets[0].uri);
      onUploadLogo(result.assets[0]);
    }
  }

  async function handleUseCurrentLocation() {
    try {
      const permission =
        await Location.requestForegroundPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permiso denegado",
          "Debes permitir acceso a la ubicación."
        );

        return;
      }

      const location =
        await Location.getCurrentPositionAsync(
          {}
        );

      const nextCoordinates = {
        latitude:
          location.coords.latitude,
        longitude:
          location.coords.longitude
      };

      setMarkerPosition(
        nextCoordinates
      );

      setCoordinates(
        nextCoordinates
      );

      mapRef.current?.animateToRegion(
        {
          latitude:
            nextCoordinates.latitude,
          longitude:
            nextCoordinates.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01
        },
        600
      );
    } catch {
      Alert.alert(
        "Error",
        "No fue posible obtener la ubicación."
      );
    }
  }

  function handleRegionChangeComplete(
    region: Region
  ) {
    setMarkerPosition({
      latitude: region.latitude,
      longitude: region.longitude
    });
  }

  function handleSave() {
    if (!name.trim() || !address.trim()) {
      Alert.alert(
        "Datos incompletos",
        "Nombre y direccion son obligatorios."
      );

      return;
    }

    const minimumItems = Math.max(1, Math.floor(Number(minimumOrderItems)));

    if (acceptsCard && !stripeReady) {
      Alert.alert(
        "Stripe Connect pendiente",
        "Configura Stripe Connect antes de aceptar pagos con tarjeta."
      );
      return;
    }

    if (!acceptsCash && !acceptsCard) {
      Alert.alert("Metodo de pago requerido", "Activa efectivo, tarjeta o ambos.");
      return;
    }

    onSave({
      name: name.trim(),
      logo: businessProfile.logo ?? undefined,
      address: address.trim(),
      acceptsCash,
      acceptsCard,
      minimumOrderItems: Number.isFinite(minimumItems) ? minimumItems : 1,
      alertsEnabled,
      coordinates
    });
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.sectionTitle}>
        Perfil del negocio
      </Text>

      <View style={styles.logoRow}>
        {logoPreview ? (
          <Image
            source={{ uri: logoPreview }}
            style={styles.logoPreview}
          />
        ) : (
          <View style={styles.logoPlaceholder}>
            <Text style={styles.logoPlaceholderText}>
              {name.charAt(0).toUpperCase() || "R"}
            </Text>
          </View>
        )}

        <View style={styles.logoContent}>
          <Text style={styles.label}>
            Logo del negocio
          </Text>
          <Text style={styles.switchDescription}>
            Usa una imagen cuadrada para que se vea bien en la app.
          </Text>
        </View>

        <Pressable
          disabled={isLoading}
          onPress={handlePickLogo}
          style={styles.logoButton}
        >
          <Text style={styles.logoButtonText}>
            Cambiar
          </Text>
        </Pressable>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>
          Nombre del negocio
        </Text>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Nombre del negocio"
          placeholderTextColor={
            colors.textMuted
          }
          style={styles.input}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>
          Dirección
        </Text>

        <TextInput
          value={address}
          onChangeText={setAddress}
          placeholder="Dirección del negocio"
          placeholderTextColor={
            colors.textMuted
          }
          style={[
            styles.input,
            styles.textArea
          ]}
          multiline
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>
          Metodos de pago aceptados
        </Text>
        <View style={styles.stripePanel}>
          <Text style={styles.stripeStatus}>
            {stripeStatusLabel}
          </Text>
          <Text style={styles.stripeDescription}>
            {stripeStatusDescription}
          </Text>
          {stripeReady ? null : (
            <View style={styles.stripeActions}>
              <Pressable
                disabled={isLoading}
                onPress={onConnectStripe}
                style={styles.stripeButton}
              >
                <Text style={styles.stripeButtonText}>
                  {businessProfile.stripeConnectedAccountId ? "Continuar Stripe" : "Configurar Stripe"}
                </Text>
              </Pressable>
              <Pressable
                disabled={isLoading || !businessProfile.stripeConnectedAccountId}
                onPress={onRefreshStripeStatus}
                style={[
                  styles.stripeButtonSecondary,
                  (!businessProfile.stripeConnectedAccountId || isLoading) &&
                    styles.stripeButtonDisabled
                ]}
              >
                <Text style={styles.stripeButtonSecondaryText}>
                  Actualizar estado
                </Text>
              </Pressable>
            </View>
          )}
        </View>
        <View style={styles.paymentOptions}>
          <Pressable
            onPress={() => setAcceptsCash((current) => !current)}
            style={[styles.paymentOption, acceptsCash && styles.paymentOptionActive]}
          >
            <Text style={[styles.paymentOptionText, acceptsCash && styles.paymentOptionTextActive]}>
              Efectivo
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (!stripeReady) {
                setAcceptsCard(false);
                Alert.alert(
                  "Stripe Connect pendiente",
                  "Completa Stripe Connect antes de activar pagos con tarjeta."
                );
                return;
              }

              setAcceptsCard((current) => !current);
            }}
            style={[
              styles.paymentOption,
              acceptsCard && styles.paymentOptionActive,
              !stripeReady && styles.paymentOptionDisabled
            ]}
          >
            <Text style={[
              styles.paymentOptionText,
              acceptsCard && styles.paymentOptionTextActive,
              !stripeReady && styles.paymentOptionTextDisabled
            ]}>
              Tarjeta
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>
          Minimo de productos por pedido
        </Text>

        <TextInput
          value={minimumOrderItems}
          onChangeText={setMinimumOrderItems}
          keyboardType="number-pad"
          placeholder="1"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
      </View>

      <View style={styles.switchContainer}>
        <View>
          <Text style={styles.label}>
            Alertas
          </Text>

          <Text
            style={
              styles.switchDescription
            }
          >
            Recibir notificaciones
          </Text>
        </View>

        <Switch
          value={alertsEnabled}
          onValueChange={
            setAlertsEnabled
          }
          trackColor={{
            false: "#666",
            true: colors.primary
          }}
        />
      </View>

      <View style={styles.mapHeader}>
        <Text style={styles.label}>
          Ubicación del negocio
        </Text>

        <Pressable
          style={styles.locationButton}
          onPress={
            handleUseCurrentLocation
          }
        >
          <Text
            style={
              styles.locationButtonText
            }
          >
            Usar GPS
          </Text>
        </Pressable>
      </View>

      <Text style={styles.locationSummary}>
        {address || "Direccion del negocio no disponible"}
      </Text>

      <Pressable
        style={styles.confirmButton}
        onPress={() => setShowMapEditor((current) => !current)}
      >
        <Text
          style={styles.confirmButtonText}
        >
          {showMapEditor ? "Ocultar mapa" : "Editar ubicacion en mapa"}
        </Text>
      </Pressable>

      {showMapEditor ? (
        <>
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          onRegionChangeComplete={
            handleRegionChangeComplete
          }
          initialRegion={{
            latitude:
              coordinates.latitude,
            longitude:
              coordinates.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02
          }}
        />

        <View
          pointerEvents="none"
          style={styles.centerMarker}
        >
          <Text
            style={styles.centerMarkerIcon}
          >
            📍
          </Text>
        </View>
      </View>

      <Pressable
        style={styles.confirmButton}
        onPress={
          handleConfirmMarker
        }
      >
        <Text
          style={styles.confirmButtonText}
        >
          Confirmar ubicación actual
        </Text>
      </Pressable>
        </>
      ) : null}

      <Pressable
        style={[
          styles.saveButton,
          isLoading &&
            styles.saveButtonDisabled
        ]}
        disabled={isLoading}
        onPress={handleSave}
      >
        <Text
          style={styles.saveButtonText}
        >
          {isLoading
            ? "Guardando..."
            : "Guardar cambios"}
        </Text>
      </Pressable>
    </View>
  );
}
