import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
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

export default function ProfileScreen({ navigation, onLogout }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await sessionStorage.getUser();
      setUser(userData);
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro de que quieres cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: async () => {
            await authApi.logout();
            await sessionStorage.clearSession();
            onLogout();
          },
        },
      ]
    );
  };

  const displayName = user?.fullName ?? user?.name ?? user?.username ?? 'Cliente';
  const displayInitial = displayName.trim().charAt(0).toUpperCase() || 'C';

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Mi Perfil" onBackPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        {user && (
          <>
            <View style={styles.profileSection}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {displayInitial}
                </Text>
              </View>
              <Text style={styles.name}>{displayName}</Text>
              <Text style={styles.email}>{user.email ?? 'Sin correo registrado'}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Información Personal</Text>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Email:</Text>
                <Text style={styles.value}>{user.email}</Text>
              </View>
              {user.phone && (
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Teléfono:</Text>
                  <Text style={styles.value}>{user.phone}</Text>
                </View>
              )}
              {user.address && (
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Dirección:</Text>
                  <Text style={styles.value}>{user.address}</Text>
                </View>
              )}
            </View>

            <View style={styles.section}>
              <TouchableOpacity style={styles.menuItem}>
                <Text style={styles.menuText}>Editar Perfil</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem}>
                <Text style={styles.menuText}>Cambiar Contraseña</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem}>
                <Text style={styles.menuText}>Direcciones Guardadas</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem}>
                <Text style={styles.menuText}>Métodos de Pago</Text>
              </TouchableOpacity>
            </View>

            <PrimaryButton
              label="Cerrar Sesion"
              onPress={handleLogout}
            />
          </>
        )}
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
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  value: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
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
  logoutButton: {
    backgroundColor: colors.danger,
    marginTop: 24,
  },
  logoutText: {
    color: colors.background,
  },
});
