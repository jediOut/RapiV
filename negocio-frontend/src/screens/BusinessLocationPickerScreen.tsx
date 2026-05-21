import { useState } from "react";
import { View, StyleSheet, Pressable, Text } from "react-native";
import MapView, { Marker } from "react-native-maps";

import { colors } from "../theme/colors";

export function BusinessLocationPickerScreen() {
  const [location, setLocation] = useState({
    latitude: 19.84,
    longitude: -97.36
  });

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          ...location,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01
        }}
        onPress={(e) => {
          setLocation(e.nativeEvent.coordinate);
        }}
      >
        <Marker
          draggable
          coordinate={location}
          onDragEnd={(e) => {
            setLocation(e.nativeEvent.coordinate);
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