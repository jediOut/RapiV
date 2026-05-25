import type { TabItem } from "../../types/navigation";

export const businessTabs: TabItem[] = [
  {
    key: "home",
    label: "Inicio",
    icon: "grid-outline"
  },
  {
    key: "orders",
    label: "Pedidos",
    icon: "receipt-outline"
  },
  {
    key: "menu",
    label: "Menu",
    icon: "restaurant-outline"
  },
  {
    key: "settings",
    label: "Ajustes",
    icon: "settings-outline"
  }
];

export function toFiniteNumber(value: unknown, fallback: number) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}
