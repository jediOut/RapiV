import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthTextField } from '../../components/AuthTextField';
import { PrimaryButton } from '../../components/PrimaryButton';
import { CURRENT_TERMS_VERSION } from '../../config/legal';
import { colors } from '../../theme/colors';
import type { RegisterPayload } from '../../types/auth';

type RegisterScreenProps = {
  error: string | null;
  isLoading: boolean;
  onRegister: (payload: RegisterPayload) => void;
  onBackToLogin: () => void;
};

export default function RegisterScreen({ error, isLoading, onRegister, onBackToLogin }: RegisterScreenProps) {
  const insets = useSafeAreaInsets();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const validateForm = (): boolean => {
    if (!fullName.trim()) {
      setFormError('Nombre es requerido');
      return false;
    }

    if (!email.trim()) {
      setFormError('Correo es requerido');
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFormError('Correo inválido');
      return false;
    }

    if (!password) {
      setFormError('Contraseña es requerida');
      return false;
    }

    if (password.length < 8) {
      setFormError('Contraseña debe tener mínimo 8 caracteres');
      return false;
    }

    if (password !== confirmPassword) {
      setFormError('Las contraseñas no coinciden');
      return false;
    }

    if (!acceptedTerms) {
      setFormError('Debes aceptar los términos y condiciones para crear tu cuenta.');
      return false;
    }

    setFormError(null);
    return true;
  };

  const handleRegister = () => {
    if (!validateForm()) {
      return;
    }

    const username = email.split('@')[0].replace(/[^a-zA-Z0-9_.-]/g, '').toLowerCase();

    onRegister({
      fullName: fullName.trim(),
      email,
      password,
      phone: phone.trim() || undefined,
      username: username.length >= 3 ? username : `${username || 'usuario'}${Date.now()}`,
      termsAccepted: true,
      termsVersion: CURRENT_TERMS_VERSION,
      termsApp: 'cliente',
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.keyboardAvoidingView}
    >
    <ScrollView
      contentContainerStyle={[
        styles.container,
        {
          paddingBottom: Math.max(insets.bottom + 32, 72),
          paddingTop: Math.max(insets.top + 22, 44),
        },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.brandBlock}>
        <Image source={require("../../../assets/icon.png")} style={styles.logoImage} />
        <Text style={styles.title}>Registro de cliente</Text>
        <Text style={styles.subtitle}>Crea tu cuenta para pedir con rapidez y seguir tus entregas.</Text>
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
          label="Teléfono (opcional)"
          keyboardType="phone-pad"
          onChangeText={setPhone}
          placeholder="+51 912 345 678"
          value={phone}
        />
        <AuthTextField
          icon="lock-closed-outline"
          label="Contraseña"
          onChangeText={setPassword}
          placeholder="Mínimo 8 caracteres"
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
        <Pressable onPress={() => setAcceptedTerms((current) => !current)} style={styles.termsRow}>
          <View style={[styles.checkbox, acceptedTerms ? styles.checkboxChecked : null]}>
            {acceptedTerms ? <Text style={styles.checkboxMark}>✓</Text> : null}
          </View>
          <Text style={styles.termsText}>Acepto los términos y condiciones de RapiV Cliente.</Text>
        </Pressable>
        {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <PrimaryButton
          label={isLoading ? 'Creando cuenta...' : 'Crear cuenta'}
          onPress={handleRegister}
          disabled={isLoading}
        />
      </View>

      <Pressable onPress={onBackToLogin} style={styles.linkButton}>
        <Text style={styles.linkText}>Ya tengo cuenta</Text>
      </Pressable>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    backgroundColor: colors.background,
    flex: 1,
  },
  container: {
    backgroundColor: colors.background,
    flexGrow: 1,
    justifyContent: 'center',
    padding: 22,
  },
  brandBlock: {
    marginBottom: 28,
  },
  logoImage: {
    borderRadius: 18,
    height: 76,
    marginBottom: 18,
    width: 76,
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
  termsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  checkbox: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxMark: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '900',
  },
  termsText: {
    color: colors.textSecondary,
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
});
