import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMemo, useState } from "react";

import { OrderRow } from "../../components/OrderRow";
import { StateView } from "../../components/StateView";
import { colors } from "../../theme/colors";
import type { BusinessOrder } from "../../types/business";

type OrdersScreenProps = {
  error: string | null;
  isLoading: boolean;
  onConfirmCashPayout: (order: BusinessOrder) => void;
  onRetry: () => void;
  orders: BusinessOrder[];
  onUpdateStatus: (order: BusinessOrder, nextStatus: 'ACCEPTED' | 'PREPARING' | 'READY' | 'REJECTED' | 'DELIVERED') => void;
};

export function OrdersScreen({ error, isLoading, onConfirmCashPayout, onRetry, orders, onUpdateStatus }: OrdersScreenProps) {
  const [mode, setMode] = useState<"active" | "completed">("active");
  const activeOrders = useMemo(
    () => orders.filter((order) => !["DELIVERED", "REJECTED", "CANCELLED"].includes(order.status)),
    [orders]
  );
  const completedOrders = useMemo(
    () => orders.filter((order) => ["DELIVERED", "REJECTED", "CANCELLED"].includes(order.status)),
    [orders]
  );
  const historySummary = useMemo(
    () => ({
      delivered: completedOrders.filter((order) => order.status === "DELIVERED").length,
      cancelled: completedOrders.filter((order) => ["REJECTED", "CANCELLED"].includes(order.status)).length,
      refunded: completedOrders.filter((order) => order.paymentStatus === "REFUNDED").length
    }),
    [completedOrders]
  );
  const visibleOrders = mode === "active" ? activeOrders : completedOrders;

  return (
    <View style={styles.panel}>
      <Text style={styles.sectionTitle}>Pedidos entrantes</Text>
      <Text style={styles.mutedText}>Acepta, prepara y marca pedidos listos para reparto.</Text>
      <View style={styles.segmentedControl}>
        <Pressable
          onPress={() => setMode("active")}
          style={[styles.segment, mode === "active" && styles.activeSegment]}
        >
          <Text style={[styles.segmentText, mode === "active" && styles.activeSegmentText]}>
            Activos ({activeOrders.length})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode("completed")}
          style={[styles.segment, mode === "completed" && styles.activeSegment]}
        >
          <Text style={[styles.segmentText, mode === "completed" && styles.activeSegmentText]}>
            Historial ({completedOrders.length})
          </Text>
        </Pressable>
      </View>
      {mode === "completed" && completedOrders.length > 0 ? (
        <View style={styles.historySummary}>
          <HistoryMetric label="Entregados" value={historySummary.delivered} />
          <HistoryMetric label="Cancelados" value={historySummary.cancelled} />
          <HistoryMetric label="Reembolsos" value={historySummary.refunded} />
        </View>
      ) : null}
      {isLoading ? (
        <StateView
          compact
          message="Estamos consultando los pedidos del negocio."
          title="Cargando pedidos"
          type="loading"
        />
      ) : error ? (
        <StateView
          actionLabel="Reintentar"
          compact
          message={error}
          onAction={onRetry}
          title={error.includes("Sin conexion") ? "Sin conexión" : "No pudimos cargar pedidos"}
          type="error"
        />
      ) : visibleOrders.length === 0 ? (
        <StateView
          compact
          message={
            mode === "active"
              ? "Los pedidos nuevos aparecerán aquí cuando los clientes ordenen."
              : "Los pedidos entregados, rechazados o cancelados aparecerán aquí."
          }
          title={mode === "active" ? "No hay pedidos activos" : "No hay historial"}
        />
      ) : (
        visibleOrders.map((order) => (
          <OrderRow
            key={order.id}
            order={order}
            onConfirmCashPayout={onConfirmCashPayout}
            onUpdateStatus={onUpdateStatus}
          />
        ))
      )}
    </View>
  );
}

function HistoryMetric({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.historyMetric}>
      <Text style={styles.historyMetricValue}>{value}</Text>
      <Text style={styles.historyMetricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
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
  segmentedControl: {
    backgroundColor: colors.background,
    borderRadius: 8,
    flexDirection: "row",
    gap: 6,
    marginTop: 14,
    padding: 4
  },
  segment: {
    alignItems: "center",
    borderRadius: 8,
    flex: 1,
    paddingVertical: 10
  },
  activeSegment: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1
  },
  segmentText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800"
  },
  activeSegmentText: {
    color: colors.primary
  },
  historySummary: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12
  },
  historyMetric: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 10
  },
  historyMetricValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center"
  },
  historyMetricLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
    textAlign: "center"
  }
});
