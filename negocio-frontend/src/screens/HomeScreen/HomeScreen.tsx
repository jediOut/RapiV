import { StyleSheet, Switch, Text, View } from "react-native";

import { MetricCard } from "../../components/MetricCard";
import { OrderRow } from "../../components/OrderRow";
import { StateView } from "../../components/StateView";
import { colors } from "../../theme/colors";
import type { BusinessOrder } from "../../types/business";

type HomeScreenProps = {
  activeOrders: number;
  availableProducts: number;
  isOpen: boolean;
  orders: BusinessOrder[];
  prepTime: string;
  salesTotal: number;
  setIsOpen: (value: boolean) => void;
};

export function HomeScreen({
  activeOrders,
  availableProducts,
  isOpen,
  orders,
  prepTime,
  salesTotal,
  setIsOpen
}: HomeScreenProps) {
  return (
    <View>
      <View style={styles.controlBand}>
        <View>
          <Text style={styles.sectionTitle}>Operacion de hoy</Text>
          <Text style={styles.mutedText}>Control rapido del negocio</Text>
        </View>
        <Switch
          onValueChange={setIsOpen}
          thumbColor={isOpen ? colors.primary : colors.muted}
          trackColor={{ false: colors.disabled, true: colors.primaryBorder }}
          value={isOpen}
        />
      </View>

      <View style={styles.metricsGrid}>
        <MetricCard icon="receipt-outline" label="Pedidos activos" value={String(activeOrders)} />
        <MetricCard icon="cash-outline" label="Ventas" value={`$${salesTotal}`} />
        <MetricCard icon="time-outline" label="Preparacion" value={`${prepTime} min`} />
        <MetricCard icon="fast-food-outline" label="Disponibles" value={String(availableProducts)} />
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Pedidos recientes</Text>
        {orders.length === 0 ? (
          <StateView
            compact
            message="Cuando llegue un pedido, veras aqui los mas recientes."
            title="Sin pedidos recientes"
          />
        ) : (
          orders.slice(0, 2).map((order) => (
            <OrderRow key={order.id} compact order={order} />
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  controlBand: {
    alignItems: "center",
    backgroundColor: colors.primaryBand,
    borderColor: colors.primaryBorder,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
    padding: 16
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0,
    marginBottom: 4
  },
  mutedText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 14
  },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    padding: 16
  }
});
