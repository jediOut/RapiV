import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { GoogleSignInButton } from '../../components/GoogleSignInButton';
import { colors } from '../../theme/colors';

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
    <ScrollView contentContainerStyle={loginStyles.container} keyboardShouldPersistTaps="handled">
      <View style={loginStyles.brandBlock}>
        <Text style={loginStyles.brand}>RapiV</Text>
        <Text style={loginStyles.title}>Acceso para clientes</Text>
        <Text style={loginStyles.subtitle}>Entra con Google para ordenar y recibir tu pedido a tiempo.</Text>
      </View>

      <View style={loginStyles.form}>
        {error ? <Text style={loginStyles.errorText}>{error}</Text> : null}
        <GoogleSignInButton
          disabled={isLoading}
          onError={onGoogleError}
          onToken={onGoogleLogin}
        />
      </View>
    </ScrollView>
  );
}

const loginStyles = StyleSheet.create({
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
  }
});
