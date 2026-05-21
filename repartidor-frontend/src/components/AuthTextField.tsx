import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { colors } from "../theme/colors";

type AuthTextFieldProps = {
  icon?: keyof typeof Ionicons.glyphMap;
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "default" | "email-address" | "phone-pad";
  secureTextEntry?: boolean;
  error?: string;
};

export function AuthTextField({
  icon,
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  secureTextEntry = false,
  error
}: AuthTextFieldProps) {
  return (
    <View style={styles.fieldGroup}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.inputRow}>
        {icon ? <Ionicons name={icon} size={20} color={colors.primary} /> : null}
        <TextInput
          autoCapitalize="none"
          keyboardType={keyboardType}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          secureTextEntry={secureTextEntry}
          style={styles.input}
          value={value}
        />
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
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
  errorText: {
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18
  }
});