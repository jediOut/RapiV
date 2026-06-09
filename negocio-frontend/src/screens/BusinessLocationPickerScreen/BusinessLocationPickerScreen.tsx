import { useState } from "react";
import { View, StyleSheet, Pressable, Text } from "react-native";
import MapView, { Marker } from "react-native-maps";

import { VEGA_MAP_LIMITS, clampToVegaBounds, defaultVegaRegion, regionInVega } from "../../config/mapBounds";
import { colors } from "../../theme/colors";

export function BusinessLocationPickerScreen() {
  const [location, setLocation] = useState({
    latitude: 20.0289,
    longitude: -96.6472
  });

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={defaultVegaRegion(0.02)}
        maxZoomLevel={VEGA_MAP_LIMITS.maxZoomLevel}
        minZoomLevel={VEGA_MAP_LIMITS.minZoomLevel}
        region={regionInVega(location)}
        onPress={(e) => {
          setLocation(clampToVegaBounds(e.nativeEvent.coordinate));
        }}
      >
        <Marker
          draggable
          coordinate={clampToVegaBounds(location)}
          onDragEnd={(e) => {
            setLocation(clampToVegaBounds(e.nativeEvent.coordinate));
          }}
        />
      </MapView>

      <Pressable style={styles.button}>
        <Text style={styles.buttonText}>
          Confirmar ubicación
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },

  map: {
    flex: 1
  },

  button: {
    backgroundColor: colors.primary,
    padding: 16,
    alignItems: "center"
  },

  buttonText: {
    color: "#fff",
    fontWeight: "700"
  }
});
