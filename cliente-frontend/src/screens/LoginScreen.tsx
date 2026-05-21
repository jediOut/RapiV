import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AuthTextField } from '../components/AuthTextField';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../theme/colors';
import type { LoginPayload } from '../types/auth';

type LoginScreenProps = {
  error: string | null;
  isLoading: boolean;
  onLogin: (payload: LoginPayload) => void;
  onCreateAccount: () => void;
};

export function LoginScreen({ error, isLoading, onLogin, onCreateAccount }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <ScrollView contentContainerStyle={loginStyles.container} keyboardShouldPersistTaps="handled">
      <View style={loginStyles.brandBlock}>
        <Text style={loginStyles.brand}>RapiV</Text>
        <Text style={loginStyles.title}>Acceso para clientes</Text>
        <Text style={loginStyles.subtitle}>Inicia sesión para ordenar rápido y recibir tu pedido a tiempo.</Text>
      </View>

      <View style={loginStyles.form}>
        <AuthTextField
          icon="mail-outline"
          keyboardType="email-address"
          label="Correo"
          onChangeText={setEmail}
          placeholder="correo@ejemplo.com"
          value={email}
        />
        <AuthTextField
          icon="lock-closed-outline"
          label="Contraseña"
          onChangeText={setPassword}
          placeholder="Tu contraseña"
          secureTextEntry
          value={password}
        />
        {error ? <Text style={loginStyles.errorText}>{error}</Text> : null}
        <PrimaryButton
          disabled={isLoading}
          label={isLoading ? 'Entrando...' : 'Entrar'}
          onPress={() => onLogin({ email, password })}
        />
      </View>

      <Pressable onPress={onCreateAccount} style={loginStyles.linkButton}>
        <Text style={loginStyles.linkText}>Crear una cuenta de cliente</Text>
      </Pressable>
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
  linkButton: {
    alignItems: "center",
    marginTop: 18,
    paddingVertical: 12
  },
  linkText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "800"
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18
  }
});
