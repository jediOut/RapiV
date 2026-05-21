import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme/colors";

type HeaderProps = {
  businessName: string;
  isOpen: boolean;
  onLogout: () => void;
};

export function Header({ businessName, isOpen, onLogout }: HeaderProps) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.brand}>RapiV</Text>
        <Text style={styles.businessName}>{businessName}</Text>
      </View>
      <View style={styles.actions}>
        <View style={[styles.statusPill, isOpen ? styles.openPill : styles.closedPill]}>
          <Ionicons name={isOpen ? "radio-button-on" : "pause-circle"} size={14} color="#FFFFFF" />
          <Text style={styles.statusPillText}>{isOpen ? "Abierto" : "Pausado"}</Text>
        </View>
        <Pressable onPress={onLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={20} color={colors.muted} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  brand: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  businessName: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0,
    marginTop: 2
  },
  actions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  statusPill: {
    alignItems: "center",
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  openPill: {
    backgroundColor: colors.primary
  },
  closedPill: {
    backgroundColor: colors.muted
  },
  statusPillText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: "800"
  },
  logoutButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38
  }
});
