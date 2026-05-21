import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "../theme/colors";

type MetricCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
};

export function MetricCard({ icon, label, value }: MetricCardProps) {
  return (
    <View style={styles.metricCard}>
      <Ionicons name={icon} size={22} color={colors.primary} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  metricCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 112,
    padding: 14,
    width: "48%"
  },
  metricValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 0,
    marginTop: 10
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4
  }
});
