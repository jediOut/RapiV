import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
  RAPIV_BUSINESS_COMMISSION_PERCENT,
  RAPIV_DELIVERY_OPERATION_FEE_MXN
} from "../../config/legal";

import { GoogleSignInButton } from "../../components/GoogleSignInButton";
import { colors } from "../../theme/colors";

type LoginScreenProps = {
  error: string | null;
  isLoading: boolean;
  onGoogleLogin: (idToken: string) => Promise<void> | void;
  onGoogleError: (message: string) => void;
};

export function LoginScreen({
  error,
  isLoading,
  onGoogleLogin,
  onGoogleError
}: LoginScreenProps) {
  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.brandBlock}>
        <Text style={styles.brand}>RapiV</Text>
        <Text style={styles.title}>Acceso para negocios</Text>
        <Text style={styles.subtitle}>Entra con Google para administrar pedidos, menu y perfil de tu comercio.</Text>
      </View>

      <View style={styles.form}>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <GoogleSignInButton
          disabled={isLoading}
          onError={onGoogleError}
          onToken={onGoogleLogin}
        />
        <Text style={styles.termsText}>
          Al continuar con Google aceptas los terminos y condiciones de RapiV Negocios.
          RapiV cobra {RAPIV_BUSINESS_COMMISSION_PERCENT}% por venta y ${RAPIV_DELIVERY_OPERATION_FEE_MXN} MXN de comision operativa en pedidos con entrega.
          Estas comisiones pueden cambiar por costos operativos.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flexGrow: 1,
    justifyContent: "center",
    padding: 22
  },
  brandBlock: {
    marginBottom: 28
  },
  brand: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 0,
    marginTop: 8
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8
  },
  form: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 16,
    padding: 16
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18
  },
  termsText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    textAlign: "center"
  }
});
