import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/colors";
import { GoogleSignInButton } from "../../components/GoogleSignInButton";

type LoginScreenProps = {
  error: string | null;
  isLoading: boolean;
  onGoogleLogin: (idToken: string) => Promise<void> | void;
  onGoogleError: (message: string) => void;
};

export default function LoginScreen({
  error,
  isLoading,
  onGoogleLogin,
  onGoogleError
}: LoginScreenProps) {
  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.brandBlock}>
        <Text style={styles.brand}>RapiV</Text>
        <Text style={styles.title}>Acceso para repartidores</Text>
        <Text style={styles.subtitle}>Entra con Google para recibir pedidos y entregar desde tu celular.</Text>
      </View>

      <View style={styles.form}>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <GoogleSignInButton
          disabled={isLoading}
          onError={onGoogleError}
          onToken={onGoogleLogin}
        />
      </View>
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
  errorText: {
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
});
