import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import * as Location from "expo-location";
import MapView, { Marker, MapPressEvent } from "react-native-maps";

import { AuthTextField } from "../components/AuthTextField";
import { PrimaryButton } from "../components/PrimaryButton";

import { colors } from "../theme/colors";
import { VEGA_SERVICE_address } from "../config/serviceAddress";
import { resolveAddressFromCoordinates } from "../utils/locationAddress";

type BusinessProfileRequiredScreenProps = {
  error: string | null;
  isLoading: boolean;
  profileName: string;
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
  profileName,
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
    setSelectedLocation(coordinates);
    const resolvedAddress = await resolveAddressFromCoordinates(coordinates);

    if (resolvedAddress) {
      setaddress(resolvedAddress);
    }
  }

  async function useCurrentLocation() {
    setLocationError(null);
    const permission = await Location.requestForegroundPermissionsAsync();

    if (permission.status !== "granted") {
      setLocationError("Permite la ubicacion para usar tu posicion actual");
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

  return (
    <View style={styles.container}>
      <View style={styles.panel}>
        <Text style={styles.brand}>RapiV</Text>
        <Text style={styles.title}>Perfil de negocio requerido</Text>
        <Text style={styles.body}>
          Estas iniciando sesion en la app de negocios con un perfil de {profileName}. Para usar
          esta app debes registrar un negocio real asociado a esta cuenta.
        </Text>
        <Text style={styles.body}>
          Para volver a tu perfil original, cierra sesion e inicia sesion en su aplicacion
          correspondiente.
        </Text>

        <AuthTextField
          icon="storefront-outline"
          label="Nombre del negocio"
          onChangeText={setName}
          placeholder="Ej. Taqueria Centro"
          value={name}
        />

        <View style={styles.mapBlock}>
          <Text style={styles.mapTitle}>Ubicacion dentro de Vega de Alatorre</Text>
          <MapView
            initialRegion={VEGA_SERVICE_address}
            maxZoomLevel={18}
            minZoomLevel={11}
            onPress={handleMapPress}
            region={
              selectedLocation
                ? {
                    ...selectedLocation,
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.02
                  }
                : VEGA_SERVICE_address
            }
            style={styles.map}
          >
            {selectedLocation ? <Marker coordinate={selectedLocation} title="Mi negocio" /> : null}
          </MapView>
          {locationError ? <Text style={styles.errorText}>{locationError}</Text> : null}
          <PrimaryButton label="Usar mi ubicacion actual" onPress={useCurrentLocation} variant="secondary" />
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
            onPress={() =>
              onCreateBusiness({
                name,
                address,
                latitude: selectedLocation?.latitude,
                longitude: selectedLocation?.longitude
              })
            }
          />
          <PrimaryButton label="Cerrar sesion" onPress={onLogout} variant="secondary" />
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
