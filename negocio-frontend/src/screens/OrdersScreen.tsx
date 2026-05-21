import { StyleSheet, Text, View } from "react-native";

import { OrderRow } from "../components/OrderRow";
import { StateView } from "../components/StateView";
import { colors } from "../theme/colors";
import type { BusinessOrder } from "../types/business";

type OrdersScreenProps = {
  error: string | null;
  isLoading: boolean;
  onRetry: () => void;
  orders: BusinessOrder[];
  onUpdateStatus: (order: BusinessOrder, nextStatus: 'ACCEPTED' | 'PREPARING' | 'READY' | 'REJECTED') => void;
};

export function OrdersScreen({ error, isLoading, onRetry, orders, onUpdateStatus }: OrdersScreenProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.sectionTitle}>Pedidos entrantes</Text>
      <Text style={styles.mutedText}>Acepta, prepara y marca pedidos listos para reparto.</Text>
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
          title={error.includes("Sin conexion") ? "Sin conexion" : "No pudimos cargar pedidos"}
          type="error"
        />
      ) : orders.length === 0 ? (
        <StateView
          compact
          message="Los pedidos nuevos apareceran aqui cuando los clientes ordenen."
          title="No hay pedidos para este negocio"
        />
      ) : (
        orders.map((order) => (
          <OrderRow key={order.id} order={order} onUpdateStatus={onUpdateStatus} />
        ))
      )}
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
});
