import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "../theme/colors";

type HeaderProps = {
  businessName: string;
  isOpen: boolean;
  onLogout: () => void;
};

export function Header({ businessName, isOpen, onLogout }: HeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
      <View style={styles.titleBlock}>
        <View style={styles.brandRow}>
          <Image source={require("../../assets/icon.png")} style={styles.headerLogo} />
          <Text style={styles.brand}>RapiV Negocios</Text>
        </View>
        <Text numberOfLines={2} ellipsizeMode="tail" style={styles.businessName}>{businessName}</Text>
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
    alignItems: "flex-start",
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14
  },
  titleBlock: {
    flex: 1,
    minWidth: 0
  },
  brandRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  headerLogo: {
    borderRadius: 8,
    height: 32,
    width: 32
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
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: 26,
    marginTop: 2
  },
  actions: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 0,
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
