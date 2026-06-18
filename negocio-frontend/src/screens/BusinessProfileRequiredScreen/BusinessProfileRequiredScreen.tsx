import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import * as Location from "expo-location";
import MapView, { Marker, MapPressEvent } from "react-native-maps";

import { AuthTextField } from "../../components/AuthTextField";
import { PrimaryButton } from "../../components/PrimaryButton";

import { colors } from "../../theme/colors";
import { VEGA_MAP_LIMITS, clampToVegaBounds, defaultVegaRegion, regionInVega } from "../../config/mapBounds";
import { resolveAddressFromCoordinates } from "../../utils/locationAddress";

type BusinessProfileRequiredScreenProps = {
  error: string | null;
  isLoading: boolean;
  onCreateBusiness: (payload: {
    name: string;
    address: string;
    latitude?: number;
    longitude?: number;
  }) => void;
  onLogout: () => void;
};

export function BusinessProfileRequiredScreen({
  error,
  isLoading,
  onCreateBusiness,
  onLogout
}: BusinessProfileRequiredScreenProps) {
  const [name, setName] = useState("");
  const [address, setaddress] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  async function applyLocation(coordinates: { latitude: number; longitude: number }) {
    const boundedCoordinates = clampToVegaBounds(coordinates);
    setSelectedLocation(boundedCoordinates);
    const resolvedAddress = await resolveAddressFromCoordinates(boundedCoordinates);

    if (resolvedAddress) {
      setaddress(resolvedAddress);
    }
  }

  async function useCurrentLocation() {
    setLocationError(null);
    const permission = await Location.requestForegroundPermissionsAsync();

    if (permission.status !== "granted") {
      setLocationError("Permite la ubicación para usar tu posición actual");
      return;
    }

    const current = await Location.getCurrentPositionAsync({});
    await applyLocation({
      latitude: current.coords.latitude,
      longitude: current.coords.longitude
    });
  }

  function handleMapPress(event: MapPressEvent) {
    void applyLocation(event.nativeEvent.coordinate);
  }

  function handleCreateBusiness() {
    if (!name.trim()) {
      setLocationError("Escribe el nombre del negocio.");
      return;
    }

    if (!address.trim()) {
      setLocationError("Escribe la dirección o zona del negocio.");
      return;
    }

    if (!selectedLocation) {
      setLocationError("Marca la ubicación del negocio con GPS o el mapa.");
      return;
    }

    setLocationError(null);
    onCreateBusiness({
      name,
      address,
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.panel}>
        <Image source={require("../../../assets/icon.png")} style={styles.logoImage} />
        <Text style={styles.title}>Perfil de negocio requerido</Text>
        <Text style={styles.body}>
          Para usar esta app debes registrar un negocio real asociado a esta cuenta.
        </Text>
        <Text style={styles.body}>
          Si este no es el correo del negocio, cierra sesión e inicia sesión con la cuenta correcta.
        </Text>

        <AuthTextField
          icon="storefront-outline"
          label="Nombre del negocio"
          onChangeText={setName}
          placeholder="Ej. Taqueria Centro"
          value={name}
        />

        <View style={styles.mapBlock}>
          <Text style={styles.mapTitle}>Ubicación dentro de Vega de Alatorre</Text>
          <MapView
            initialRegion={defaultVegaRegion()}
            maxZoomLevel={VEGA_MAP_LIMITS.maxZoomLevel}
            minZoomLevel={VEGA_MAP_LIMITS.minZoomLevel}
            onPress={handleMapPress}
            region={
              selectedLocation
                ? regionInVega(selectedLocation)
                : defaultVegaRegion()
            }
            style={styles.map}
          >
            {selectedLocation ? <Marker coordinate={clampToVegaBounds(selectedLocation)} title="Mi negocio" /> : null}
          </MapView>
          {locationError ? <Text style={styles.errorText}>{locationError}</Text> : null}
          <PrimaryButton label="Usar mi ubicación actual" onPress={useCurrentLocation} variant="secondary" />
        </View>
        <AuthTextField
          icon="location-outline"
          label="Zona"
          onChangeText={setaddress}
          placeholder="Ej. Centro"
          value={address}
        />
        {selectedLocation ? (
          <Text style={styles.locationText}>
            {address.trim() || "Ubicación marcada en el mapa."}
          </Text>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.actions}>
          <PrimaryButton
            disabled={isLoading}
            label={isLoading ? "Registrando..." : "Registrar negocio"}
            onPress={handleCreateBusiness}
          />
          <PrimaryButton label="Cerrar sesión" onPress={onLogout} variant="secondary" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: "center",
    padding: 22
  },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 18
  },
  logoImage: {
    borderRadius: 16,
    height: 64,
    width: 64
  },
  brand: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  title: {
    color: colors.text,
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: 0
  },
  body: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22
  },
  actions: {
    gap: 12,
    marginTop: 4
  },
  mapBlock: {
    gap: 10
  },
  mapTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800"
  },
  map: {
    borderRadius: 8,
    height: 180,
    overflow: "hidden"
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18
  },
  locationText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18
  }
});
