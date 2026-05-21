import { Pressable, StyleSheet, Text } from "react-native";

import { colors } from "../theme/colors";

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
};

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  variant = "primary"
}: PrimaryButtonProps) {
  const isSecondary = variant === "secondary";

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        isSecondary ? styles.secondaryButton : styles.primaryButton,
        disabled && styles.disabledButton
      ]}
    >
      <Text style={[styles.text, isSecondary ? styles.secondaryText : styles.primaryText]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: 16
  },
  primaryButton: {
    backgroundColor: colors.primary
  },
  secondaryButton: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryBorder,
    borderWidth: 1
  },
  disabledButton: {
    opacity: 0.6
  },
  text: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0
  },
  primaryText: {
    color: colors.surface
  },
  secondaryText: {
    color: colors.primary
  }
});
