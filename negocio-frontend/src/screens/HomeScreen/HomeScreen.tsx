import { Pressable, StyleSheet, Switch, Text, View } from "react-native";

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
  onOpenOrders: () => void;
  prepTime: string;
  salesTotal: number;
  setIsOpen: (value: boolean) => void;
};

export function HomeScreen({
  activeOrders,
  availableProducts,
  isOpen,
  onOpenOrders,
  orders,
  prepTime,
  salesTotal,
  setIsOpen
}: HomeScreenProps) {
  const activeOrderList = orders.filter((order) => !["DELIVERED", "REJECTED", "CANCELLED"].includes(order.status));

  return (
    <View>
      <View style={styles.controlBand}>
        <View>
          <Text style={styles.sectionTitle}>Operación de hoy</Text>
          <Text style={styles.mutedText}>Control rápido del negocio</Text>
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
        <MetricCard icon="time-outline" label="Preparación" value={`${prepTime} min`} />
        <MetricCard icon="fast-food-outline" label="Disponibles" value={String(availableProducts)} />
      </View>

      <View style={[styles.panel, activeOrderList.length > 0 && styles.priorityPanel]}>
        <View style={styles.panelHeader}>
          <View>
            <Text style={styles.sectionTitle}>Pedidos activos</Text>
            <Text style={styles.mutedText}>
              {activeOrderList.length > 0
                ? 'Revisa y actualiza el siguiente paso.'
                : 'Cuando llegue un pedido, aparecerá aquí.'}
            </Text>
          </View>
          <Pressable onPress={onOpenOrders} style={styles.panelAction}>
            <Text style={styles.panelActionText}>Ver pedidos</Text>
          </Pressable>
        </View>
        {activeOrderList.length === 0 ? (
          <StateView compact message="Tu negocio está listo para recibir pedidos." title="Sin pedidos activos" />
        ) : (
          activeOrderList.slice(0, 2).map((order) => (
            <OrderRow key={order.id} compact order={order} />
          ))
        )}
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Pedidos recientes</Text>
        {orders.length === 0 ? (
          <StateView
            compact
            message="Cuando llegue un pedido, verás aquí los más recientes."
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
  },
  priorityPanel: {
    borderColor: colors.primaryBorder,
    borderWidth: 2
  },
  panelHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    marginBottom: 4
  },
  panelAction: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    flexShrink: 0,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 12
  },
  panelActionText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: "900"
  }
});
