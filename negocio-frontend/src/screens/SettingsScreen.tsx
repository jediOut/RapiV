import { useRef, useState } from "react";
import {
  Alert,
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

import { colors } from "../theme/colors";

type Coordinates = {
  latitude: number;
  longitude: number;
};

type BusinessProfile = {
  name?: string;
  address?: string;
  paymentMode?: string;
  alertsEnabled?: boolean;
  coordinates?: Coordinates;
};

type UpdateBusinessPayload = {
  name: string;
  address: string;
  paymentMode: string;
  alertsEnabled: boolean;
  coordinates: Coordinates;
};

type SettingsScreenProps = {
  businessProfile: BusinessProfile;
  isLoading: boolean;
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
    onSave({
      name,
      address,
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