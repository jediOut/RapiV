import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
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

import { colors } from "../theme/colors";

type Coordinates = {
  latitude: number;
  longitude: number;
};

type BusinessProfile = {
  id?: string;
  name?: string;
  logo?: string | null;
  address?: string;
  paymentMode?: string;
  alertsEnabled?: boolean;
  coordinates?: Coordinates;
};

type UpdateBusinessPayload = {
  name: string;
  logo?: string;
  address: string;
  paymentMode: string;
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
};

const DEFAULT_COORDINATES = {
  latitude: 20.0287,
  longitude: -96.6473
};

export function SettingsScreen({
  businessProfile,
  isLoading,
  onUploadLogo,
  onSave
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

  const [paymentMode, setPaymentMode] =
    useState(
      businessProfile.paymentMode ?? ""
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
    setPaymentMode(businessProfile.paymentMode ?? "");
    setAlertsEnabled(businessProfile.alertsEnabled ?? true);
    setCoordinates(nextCoordinates);
    setMarkerPosition(nextCoordinates);
  }, [
    businessProfile.name,
    businessProfile.address,
    businessProfile.logo,
    businessProfile.paymentMode,
    businessProfile.alertsEnabled,
    businessProfile.coordinates?.latitude,
    businessProfile.coordinates?.longitude
  ]);

  function isInsideServiceArea(
    latitude: number,
    longitude: number
  ) {
    return (
      latitude >= 19.95 &&
      latitude <= 20.10 &&
      longitude >= -96.75 &&
      longitude <= -96.55
    );
  }

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

    onSave({
      name: name.trim(),
      logo: businessProfile.logo ?? undefined,
      address: address.trim(),
      paymentMode,
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
          Método de pago
        </Text>

        <TextInput
          value={paymentMode}
          onChangeText={
            setPaymentMode
          }
          placeholder="Efectivo, transferencia..."
          placeholderTextColor={
            colors.textMuted
          }
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

const styles = StyleSheet.create({
  panel: {
    backgroundColor:
      colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16
  },

  sectionTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 20
  },

  field: {
    marginBottom: 18
  },

  logoRow: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginBottom: 18,
    padding: 12
  },

  logoPreview: {
    borderRadius: 12,
    height: 64,
    width: 64
  },

  logoPlaceholder: {
    alignItems: "center",
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    height: 64,
    justifyContent: "center",
    width: 64
  },

  logoPlaceholderText: {
    color: colors.primary,
    fontSize: 26,
    fontWeight: "900"
  },

  logoContent: {
    flex: 1
  },

  logoButton: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryBorder,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10
  },

  logoButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800"
  },

  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8
  },

  input: {
    backgroundColor:
      colors.background,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12
  },

  textArea: {
    minHeight: 90,
    textAlignVertical: "top"
  },

  switchContainer: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent:
      "space-between",
    marginBottom: 22
  },

  switchDescription: {
    color: colors.textMuted,
    fontSize: 13
  },

  mapHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent:
      "space-between",
    marginBottom: 10
  },

  locationButton: {
    backgroundColor:
      colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10
  },

  locationButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700"
  },

  locationSummary: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10
  },

  mapContainer: {
    borderRadius: 14,
    height: 260,
    marginBottom: 14,
    overflow: "hidden",
    position: "relative"
  },

  map: {
    flex: 1
  },

  centerMarker: {
    alignItems: "center",
    justifyContent: "center",
    left: "50%",
    marginLeft: -18,
    marginTop: -36,
    position: "absolute",
    top: "50%"
  },

  centerMarkerIcon: {
    fontSize: 36
  },

  confirmButton: {
    alignItems: "center",
    backgroundColor:
      colors.background,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 18,
    paddingVertical: 14
  },

  confirmButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800"
  },

  saveButton: {
    alignItems: "center",
    backgroundColor:
      colors.primary,
    borderRadius: 12,
    paddingVertical: 15
  },

  saveButtonDisabled: {
    opacity: 0.6
  },

  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800"
  }
});
