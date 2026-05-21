import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import PrimaryButton from "../components/PrimaryButton";
import { colors } from "../theme/colors";
import { AuthTextField } from "../components/AuthTextField";

type LoginScreenProps = {
  error: string | null;
  isLoading: boolean;
  onLogin: (email: string, password: string) => void;
  onCreateAccount: () => void;
};

export default function LoginScreen({ error, isLoading, onLogin, onCreateAccount }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.brandBlock}>
        <Text style={styles.brand}>RapiV</Text>
        <Text style={styles.title}>Acceso para repartidores</Text>
        <Text style={styles.subtitle}>Recibe pedidos y entrega con confianza desde tu celular.</Text>
      </View>

      <View style={styles.form}>
        <AuthTextField
          icon="mail-outline"
          label="Correo"
          placeholder="correo@ejemplo.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
        />
        <AuthTextField
          icon="lock-closed-outline"
          label="Contraseña"
          placeholder="Tu contraseña"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        {localError ? <Text style={styles.errorText}>{localError}</Text> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <PrimaryButton
          title={isLoading ? "Entrando..." : "Entrar"}
          onPress={() => onLogin(email, password)}
        />
      </View>

      <Pressable onPress={onCreateAccount} style={styles.linkButton}>
        <Text style={styles.linkText}>Registrar como repartidor</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flexGrow: 1,
    justifyContent: "center",
    padding: 22,
  },
  brandBlock: {
    marginBottom: 28,
  },
  brand: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 0,
    marginTop: 8,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  form: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 16,
    padding: 16,
  },
  linkButton: {
    alignItems: "center",
    marginTop: 18,
    paddingVertical: 12,
  },
  linkText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "800",
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
});
