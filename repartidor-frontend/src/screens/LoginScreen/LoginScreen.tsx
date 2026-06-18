import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        {
          paddingBottom: Math.max(insets.bottom + 22, 44),
          paddingTop: Math.max(insets.top + 22, 44),
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.brandBlock}>
        <View style={styles.logoMark}>
          <Image source={require("../../../assets/icon.png")} style={styles.logoImage} />
        </View>
        <Text style={styles.title}>Acceso para repartidores</Text>
        <Text style={styles.subtitle}>Recibe ofertas, abre rutas y controla tus depósitos desde tu celular.</Text>
        <View style={styles.benefits}>
          <Benefit icon="navigate-outline" label="Rutas claras" />
          <Benefit icon="wallet-outline" label="Depósitos para efectivo" />
          <Benefit icon="cash-outline" label="Ganancias visibles" />
        </View>
      </View>

      <View style={styles.form}>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <GoogleSignInButton
          disabled={isLoading}
          onError={onGoogleError}
          onToken={onGoogleLogin}
        />
        <Text style={styles.termsText}>
          Al continuar con Google aceptas los términos y condiciones de RapiV Repartidor.
        </Text>
      </View>
    </ScrollView>
  );
}

function Benefit({
  icon,
  label
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <View style={styles.benefitItem}>
      <Ionicons name={icon} size={17} color={colors.primary} />
      <Text style={styles.benefitText}>{label}</Text>
    </View>
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
  logoMark: {
    alignItems: "center",
    borderRadius: 18,
    height: 76,
    justifyContent: "center",
    marginBottom: 18,
    overflow: "hidden",
    width: 76,
  },
  logoImage: {
    height: "100%",
    width: "100%",
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
  benefits: {
    gap: 10,
    marginTop: 18,
  },
  benefitItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 9,
  },
  benefitText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "800",
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
  termsText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    textAlign: "center",
  },
});
