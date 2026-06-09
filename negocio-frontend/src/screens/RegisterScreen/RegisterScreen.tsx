import * as Location from "expo-location";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, MapPressEvent } from "react-native-maps";

import { AuthTextField } from "../../components/AuthTextField";
import { PrimaryButton } from "../../components/PrimaryButton";
import { VEGA_MAP_LIMITS, clampToVegaBounds, defaultVegaRegion, regionInVega } from "../../config/mapBounds";
import { colors } from "../../theme/colors";
import type { RegisterBusinessPayload } from "../../types/auth";
import { resolveAddressFromCoordinates } from "../../utils/locationAddress";

type Coordinates = {
  latitude: number;
  longitude: number;
};

type RegisterScreenProps = {
  error: string | null;
  isLoading: boolean;
  onRegister: (payload: RegisterBusinessPayload) => void;
  onBackToLogin: () => void;
};

export function RegisterScreen({
  error,
  isLoading,
  onRegister,
  onBackToLogin
}: RegisterScreenProps) {
  const insets = useSafeAreaInsets();
  const [ownerName, setOwnerName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function applyCoordinates(nextCoordinates: Coordinates, shouldResolveAddress: boolean) {
    const boundedCoordinates = clampToVegaBounds(nextCoordinates);
    setCoordinates(boundedCoordinates);

    if (!shouldResolveAddress) {
      return;
    }

    setLoadingLocation(true);
    const nextAddress = await resolveAddressFromCoordinates(boundedCoordinates);
    setLoadingLocation(false);

    if (nextAddress) {
      setAddress(nextAddress);
    }
  }

  async function useCurrentLocation() {
    setFormError(null);
    setLoadingLocation(true);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== "granted") {
        setFormError("Permite la ubicación para usar tu posición actual.");
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });

      await applyCoordinates(
        {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude
        },
        true
      );
    } catch {
      setFormError("No se pudo obtener tu ubicación actual.");
    } finally {
      setLoadingLocation(false);
    }
  }

  async function searchTypedAddress() {
    const value = address.trim();

    if (value.length < 5) {
      setFormError("Escribe una dirección más específica.");
      return;
    }

    setFormError(null);
    setLoadingLocation(true);

    try {
      const results = await Location.geocodeAsync(`${value}, Vega de Alatorre, Veracruz, México`);
      const result = results[0];

      if (!result) {
        setFormError("No encontramos esa dirección. Puedes marcarla en el mapa.");
        return;
      }

      await applyCoordinates(
        {
          latitude: result.latitude,
          longitude: result.longitude
        },
        false
      );
    } catch {
      setFormError("No se pudo buscar la dirección.");
    } finally {
      setLoadingLocation(false);
    }
  }

  function handleMapPress(event: MapPressEvent) {
    void applyCoordinates(event.nativeEvent.coordinate, true);
  }

  function handleRegister() {
    if (!ownerName.trim()) {
      setFormError("El responsable es requerido.");
      return;
    }

    if (!businessName.trim()) {
      setFormError("El nombre del negocio es requerido.");
      return;
    }

    if (!address.trim()) {
      setFormError("La dirección del negocio es requerida.");
      return;
    }

    if (!coordinates) {
      setFormError("Marca la ubicacion del negocio con GPS, busqueda o el mapa.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFormError("Correo inválido.");
      return;
    }

    if (password.length < 8) {
      setFormError("Contraseña debe tener mínimo 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setFormError("Las contraseñas no coinciden.");
      return;
    }

    setFormError(null);
    onRegister({
      ownerName: ownerName.trim(),
      businessName: businessName.trim(),
      address: address.trim(),
      email: email.trim(),
      password,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude
    });
  }

  const locationStatus = coordinates
    ? address.trim() || "Ubicación marcada en el mapa."
    : "Puedes usar GPS, tocar el mapa o escribir la dirección.";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.keyboardAvoidingView}
    >
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom + 32, 72) },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.brandBlock}>
        <Text style={styles.brand}>RapiV</Text>
        <Text style={styles.title}>Registro de negocio</Text>
        <Text style={styles.subtitle}>Crea la cuenta principal y registra la ubicación del comercio.</Text>
      </View>

      <View style={styles.form}>
        <AuthTextField
          icon="person-outline"
          label="Responsable"
          onChangeText={setOwnerName}
          placeholder="Nombre del encargado"
          value={ownerName}
        />
        <AuthTextField
          icon="storefront-outline"
          label="Negocio"
          onChangeText={setBusinessName}
          placeholder="Nombre comercial"
          value={businessName}
        />

        <View style={styles.locationBlock}>
          <AuthTextField
            icon="location-outline"
            label="Dirección"
            onChangeText={setAddress}
            placeholder="Calle, número, colonia"
            value={address}
          />
          <View style={styles.locationActions}>
            <Pressable
              disabled={loadingLocation}
              onPress={useCurrentLocation}
              style={[styles.locationButton, loadingLocation ? styles.locationButtonDisabled : null]}
            >
              <Text style={styles.locationButtonText}>
                {loadingLocation ? "Buscando..." : "Usar ubicación actual"}
              </Text>
            </Pressable>
            <Pressable
              disabled={loadingLocation}
              onPress={searchTypedAddress}
              style={[styles.locationButton, loadingLocation ? styles.locationButtonDisabled : null]}
            >
              <Text style={styles.locationButtonText}>Buscar dirección</Text>
            </Pressable>
          </View>
          <Text style={styles.locationStatus}>{locationStatus}</Text>
          <MapView
            initialRegion={defaultVegaRegion()}
            maxZoomLevel={VEGA_MAP_LIMITS.maxZoomLevel}
            minZoomLevel={VEGA_MAP_LIMITS.minZoomLevel}
            onPress={handleMapPress}
            region={
              coordinates
                ? regionInVega(coordinates)
                : defaultVegaRegion()
            }
            style={styles.map}
          >
            {coordinates ? (
              <Marker
                coordinate={clampToVegaBounds(coordinates)}
                draggable
                onDragEnd={(event) => {
                  void applyCoordinates(event.nativeEvent.coordinate, true);
                }}
                title="Ubicación del negocio"
              />
            ) : null}
          </MapView>
        </View>

        <AuthTextField
          icon="mail-outline"
          keyboardType="email-address"
          label="Correo"
          onChangeText={setEmail}
          placeholder="correo@negocio.com"
          value={email}
        />
        <AuthTextField
          icon="lock-closed-outline"
          label="Contraseña"
          onChangeText={setPassword}
          placeholder="Mínimo 8 caracteres"
          secureTextEntry
          value={password}
        />
        <AuthTextField
          icon="lock-closed-outline"
          label="Confirmar contraseña"
          onChangeText={setConfirmPassword}
          placeholder="Repite tu contraseña"
          secureTextEntry
          value={confirmPassword}
        />
        {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <PrimaryButton
          disabled={isLoading || loadingLocation}
          label={isLoading ? "Creando..." : "Crear cuenta"}
          onPress={handleRegister}
        />
      </View>

      <Pressable onPress={onBackToLogin} style={styles.linkButton}>
        <Text style={styles.linkText}>Ya tengo cuenta</Text>
      </Pressable>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    backgroundColor: colors.background,
    flex: 1
  },
  container: {
    backgroundColor: colors.background,
    flexGrow: 1,
    justifyContent: "center",
    padding: 22
  },
  brandBlock: {
    marginBottom: 24
  },
  brand: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 0,
    marginTop: 8
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8
  },
  form: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 16,
    padding: 16
  },
  locationBlock: {
    gap: 10
  },
  locationActions: {
    gap: 10
  },
  locationButton: {
    alignItems: "center",
    borderColor: colors.primary,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 11
  },
  locationButtonDisabled: {
    opacity: 0.6
  },
  locationButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800"
  },
  locationStatus: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18
  },
  map: {
    borderRadius: 8,
    height: 190,
    overflow: "hidden"
  },
  linkButton: {
    alignItems: "center",
    marginTop: 18,
    paddingVertical: 12
  },
  linkText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "800"
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18
  }
});

