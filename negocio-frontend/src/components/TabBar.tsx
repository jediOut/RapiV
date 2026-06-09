import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "../theme/colors";
import type { BusinessScreen, TabItem } from "../types/navigation";

type TabBarProps = {
  activeScreen: BusinessScreen;
  tabs: TabItem[];
  onChange: (screen: BusinessScreen) => void;
};

export function TabBar({ activeScreen, tabs, onChange }: TabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {tabs.map((tab) => {
        const selected = activeScreen === tab.key;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={[styles.tabButton, selected && styles.tabButtonActive]}
          >
            <Ionicons name={tab.icon} size={21} color={selected ? colors.primary : colors.muted} />
            <Text style={[styles.tabText, selected && styles.tabTextActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: "row",
    gap: 6,
    justifyContent: "space-around",
    left: 0,
    paddingHorizontal: 10,
    paddingTop: 8,
    position: "absolute",
    right: 0
  },
  tabButton: {
    alignItems: "center",
    borderRadius: 8,
    flex: 1,
    gap: 3,
    justifyContent: "center",
    minHeight: 58
  },
  tabButtonActive: {
    backgroundColor: colors.primaryLight
  },
  tabText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800"
  },
  tabTextActive: {
    color: colors.primary
  }
});
