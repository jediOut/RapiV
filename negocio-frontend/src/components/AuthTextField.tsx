import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useState } from "react";

import { colors } from "../theme/colors";

type AuthTextFieldProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "default" | "email-address" | "phone-pad";
  secureTextEntry?: boolean;
};

export function AuthTextField({
  icon,
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  secureTextEntry = false
}: AuthTextFieldProps) {
  const [isSecureTextVisible, setIsSecureTextVisible] = useState(false);
  const shouldHideText = secureTextEntry && !isSecureTextVisible;

  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <Ionicons name={icon} size={20} color={colors.primary} />
        <TextInput
          autoCapitalize="none"
          keyboardType={keyboardType}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          secureTextEntry={shouldHideText}
          style={styles.input}
          value={value}
        />
        {secureTextEntry ? (
          <Pressable
            accessibilityLabel={isSecureTextVisible ? "Ocultar contrasena" : "Mostrar contrasena"}
            accessibilityRole="button"
            onPress={() => setIsSecureTextVisible((current) => !current)}
            style={styles.visibilityButton}
          >
            <Ionicons
              name={isSecureTextVisible ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={colors.muted}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldGroup: {
    gap: 8
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800"
  },
  inputRow: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 12
  },
  input: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    minHeight: 50
  },
  visibilityButton: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    width: 40
  }
});
