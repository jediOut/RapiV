import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AuthTextField } from '../components/AuthTextField';
import PrimaryButton from '../components/PrimaryButton';
import { colors } from '../theme/colors';
import type { RegisterPayload } from '../types/auth';

type RegisterScreenProps = {
  error: string | null;
  isLoading: boolean;
  onRegister: (payload: RegisterPayload) => void;
  onBackToLogin: () => void;
};

export default function RegisterScreen({ error, isLoading, onRegister, onBackToLogin }: RegisterScreenProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const validateForm = (): boolean => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!fullName.trim()) {
      setFormError('Nombre es requerido');
      return false;
    }

    if (!normalizedEmail) {
      setFormError('Correo es requerido');
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setFormError('Correo inválido');
      return false;
    }

    if (!password) {
      setFormError('Contraseña es requerida');
      return false;
    }

    if (password.length < 6) {
      setFormError('Contraseña debe tener mínimo 6 caracteres');
      return false;
    }

    if (password !== confirmPassword) {
      setFormError('Las contraseñas no coinciden');
      return false;
    }

    setFormError(null);
    return true;
  };

  const handleRegister = () => {
    if (!validateForm()) {
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const username = normalizedEmail.split('@')[0].replace(/[^a-zA-Z0-9_.-]/g, '').toLowerCase();

    onRegister({
      fullName: fullName.trim(),
      email: normalizedEmail,
      password,
      phone: phone.trim() || undefined,
      username: username.length >= 3 ? username : `${username || 'usuario'}${Date.now()}`,
      role: "DELIVERY"
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.brandBlock}>
        <Text style={styles.brand}>RapiV</Text>
        <Text style={styles.title}>Registro de repartidor</Text>
        <Text style={styles.subtitle}>Únete al equipo y entrega pedidos con rapidez.</Text>
      </View>

      <View style={styles.form}>
        <AuthTextField
          icon="person-outline"
          label="Nombre completo"
          onChangeText={setFullName}
          placeholder="Tu nombre"
          value={fullName}
        />
        <AuthTextField
          icon="mail-outline"
          label="Correo"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="correo@ejemplo.com"
          value={email}
        />
        <AuthTextField
          icon="call-outline"
          label="Teléfono"
          keyboardType="phone-pad"
          onChangeText={setPhone}
          placeholder="+51 912 345 678"
          value={phone}
        />
        <AuthTextField
          icon="lock-closed-outline"
          label="Contraseña"
          onChangeText={setPassword}
          placeholder="Mínimo 6 caracteres"
          secureTextEntry
          value={password}
        />
        <AuthTextField
          icon="lock-closed-outline"
          label="Confirmar contraseña"
          onChangeText={setConfirmPassword}
          placeholder="Repite tu contraseña"
          secureTextEntry
          value={confirmPassword}
        />
        {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <PrimaryButton
          title={isLoading ? 'Creando cuenta...' : 'Crear cuenta'}
          onPress={handleRegister}
          disabled={isLoading}
        />
      </View>

      <Pressable onPress={onBackToLogin} style={styles.linkButton}>
        <Text style={styles.linkText}>Ya tengo cuenta</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flexGrow: 1,
    justifyContent: 'center',
    padding: 22,
  },
  brandBlock: {
    marginBottom: 28,
  },
  brand: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
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
    alignItems: 'center',
    marginTop: 18,
    paddingVertical: 12,
  },
  linkText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '800',
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
});
