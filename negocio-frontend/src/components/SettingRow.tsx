import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "../theme/colors";

type SettingRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
};

export function SettingRow({ icon, label, value }: SettingRowProps) {
  return (
    <View style={styles.settingRow}>
      <Ionicons name={icon} size={21} color={colors.primary} />
      <View style={styles.settingText}>
        <Text style={styles.itemTitle}>{label}</Text>
        <Text style={styles.mutedText}>{value}</Text>
      </View>
      <Ionicons name="chevron-forward" size={19} color="#94A3B8" />
    </View>
  );
}

const styles = StyleSheet.create({
  settingRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingVertical: 14
  },
  settingText: {
    flex: 1
  },
  itemTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0
  },
  mutedText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18
  }
});
