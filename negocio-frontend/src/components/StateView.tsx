import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";

type StateViewProps = {
  actionLabel?: string;
  compact?: boolean;
  message: string;
  onAction?: () => void;
  title: string;
  type?: "loading" | "empty" | "error";
};

export function StateView({
  actionLabel,
  compact = false,
  message,
  onAction,
  title,
  type = "empty"
}: StateViewProps) {
  return (
    <View style={[styles.container, compact && styles.compact]}>
      {type === "loading" ? <ActivityIndicator size="large" color={colors.primary} /> : null}
      <Text style={[styles.title, type === "error" && styles.errorTitle]}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={styles.button}>
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 24
  },
  compact: {
    flex: 0,
    paddingVertical: 22
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0,
    marginTop: 10,
    textAlign: "center"
  },
  errorTitle: {
    color: "#B91C1C"
  },
  message: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 7,
    textAlign: "center"
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 11
  },
  buttonText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: "800"
  }
});
