import type { Ionicons } from "@expo/vector-icons";

export type AuthScreen = "login" | "register";
export type BusinessScreen = "home" | "orders" | "menu" | "settings";

export type TabItem = {
  key: BusinessScreen;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};
