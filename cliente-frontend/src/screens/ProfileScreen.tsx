import React, { useEffect, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Header from '../components/Header';
import { CustomerTabBar } from '../components/CustomerTabBar';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../theme/colors';
import { sessionStorage } from '../services/sessionStorage';
import { authApi } from '../services/authApi';
import { User } from '../types/auth';
import { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'> & {
  onLogout: () => void;
};

const emptyForm = {
  fullName: '',
  username: '',
  email: '',
  phone: '',
  address: '',
};

export default function ProfileScreen({ navigation, onLogout }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    void loadUserData();
  }, []);

  const syncForm = (nextUser: User | null) => {
    setForm({
      fullName: nextUser?.fullName ?? nextUser?.name ?? '',
      username: nextUser?.username ?? '',
      email: nextUser?.email ?? '',
      phone: nextUser?.phone ?? '',
      address: nextUser?.address ?? '',
    });
  };

  const loadUserData = async () => {
    const userData = await sessionStorage.getUser();
    setUser(userData);
    syncForm(userData);
  };

  const updateForm = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSaveProfile = async () => {
    const normalizedEmail = form.email.trim().toLowerCase();

    if (!form.fullName.trim() || !form.username.trim() || !normalizedEmail) {
      setFormError('Nombre, usuario y correo son obligatorios.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setFormError('Correo invalido.');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const updatedUser = await authApi.updateProfile({
        fullName: form.fullName.trim(),
        username: form.username.trim(),
        email: normalizedEmail,
        phone: form.phone.trim(),
        address: form.address.trim(),
      });

      await sessionStorage.setUser(updatedUser);
      setUser(updatedUser);
      syncForm(updatedUser);
      setIsEditing(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'No se pudo actualizar el perfil.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Cerrar sesion', 'Seguro que quieres cerrar sesion?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesion',
        style: 'destructive',
        onPress: async () => {
          await authApi.logout();
          await sessionStorage.clearSession();
          onLogout();
        },
      },
    ]);
  };

  const displayName = user?.fullName ?? user?.name ?? user?.username ?? 'Cliente';
  const displayInitial = displayName.trim().charAt(0).toUpperCase() || 'C';

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Mi Perfil" onBackPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        {user ? (
          <>
            <View style={styles.profileSection}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{displayInitial}</Text>
              </View>
              <Text style={styles.name}>{displayName}</Text>
              <Text style={styles.email}>{user.email ?? 'Sin correo registrado'}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Informacion personal</Text>
              {isEditing ? (
                <View style={styles.form}>
                  <TextInput value={form.fullName} onChangeText={(value) => updateForm('fullName', value)} placeholder="Nombre completo" placeholderTextColor={colors.textSecondary} style={styles.input} />
                  <TextInput value={form.username} onChangeText={(value) => updateForm('username', value)} autoCapitalize="none" placeholder="Usuario" placeholderTextColor={colors.textSecondary} style={styles.input} />
                  <TextInput value={form.email} onChangeText={(value) => updateForm('email', value)} autoCapitalize="none" keyboardType="email-address" placeholder="Correo" placeholderTextColor={colors.textSecondary} style={styles.input} />
                  <TextInput value={form.phone} onChangeText={(value) => updateForm('phone', value)} keyboardType="phone-pad" placeholder="Telefono" placeholderTextColor={colors.textSecondary} style={styles.input} />
                  <TextInput value={form.address} onChangeText={(value) => updateForm('address', value)} placeholder="Direccion" placeholderTextColor={colors.textSecondary} style={[styles.input, styles.textArea]} multiline />
                  {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
                  <View style={styles.formActions}>
                    <TouchableOpacity disabled={isSaving} onPress={() => { setIsEditing(false); setFormError(null); syncForm(user); }} style={[styles.secondaryButton, isSaving && styles.disabledButton]}>
                      <Text style={styles.secondaryButtonText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity disabled={isSaving} onPress={handleSaveProfile} style={[styles.saveButton, isSaving && styles.disabledButton]}>
                      <Text style={styles.saveButtonText}>{isSaving ? 'Guardando...' : 'Guardar'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Email:</Text>
                    <Text style={styles.value}>{user.email}</Text>
                  </View>
                  {user.phone ? (
                    <View style={styles.infoRow}>
                      <Text style={styles.label}>Telefono:</Text>
                      <Text style={styles.value}>{user.phone}</Text>
                    </View>
                  ) : null}
                  {user.address ? (
                    <View style={styles.infoRow}>
                      <Text style={styles.label}>Direccion:</Text>
                      <Text style={styles.value}>{user.address}</Text>
                    </View>
                  ) : null}
                  <TouchableOpacity style={styles.menuItem} onPress={() => setIsEditing(true)}>
                    <Text style={styles.menuText}>Editar perfil</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            <View style={styles.section}>
              <TouchableOpacity style={styles.menuItem}>
                <Text style={styles.menuText}>Cambiar contrasena</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem}>
                <Text style={styles.menuText}>Direcciones guardadas</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem}>
                <Text style={styles.menuText}>Metodos de pago</Text>
              </TouchableOpacity>
            </View>

            <PrimaryButton label="Cerrar sesion" onPress={handleLogout} />
          </>
        ) : null}
      </ScrollView>
      <CustomerTabBar active="profile" navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.background,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  value: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
    textAlign: 'right',
  },
  menuItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  form: {
    gap: 10,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  textArea: {
    minHeight: 74,
    textAlignVertical: 'top',
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '700',
  },
  formActions: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: '800',
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    flex: 1,
    paddingVertical: 12,
  },
  saveButtonText: {
    color: colors.background,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.6,
  },
});
