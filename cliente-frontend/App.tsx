import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LoginScreen } from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import ProductsScreen from './src/screens/ProductsScreen';
import CartScreen from './src/screens/CartScreen';
import OrdersScreen from './src/screens/OrdersScreen';
import OrderDetailScreen from './src/screens/OrderDetailScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import { StateView } from './src/components/StateView';
import { authApi } from './src/services/authApi';
import { isApiError } from './src/services/apiError';
import { registerPushNotifications } from './src/services/notificationRegistration';
import { sessionStorage } from './src/services/sessionStorage';
import { colors } from './src/theme/colors';
import { CURRENT_TERMS_VERSION } from './src/config/legal';
import type { AuthSession } from './src/types/auth';
import type { RootStackParamList } from './src/types/navigation';
import { CartProvider } from './src/context/CartContext';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  useEffect(() => {
    async function restoreSession() {
      const storedSession = await sessionStorage.loadSession();

      if (!storedSession) {
        setIsRestoringSession(false);
        return;
      }

      try {
        const validatedUser = await authApi.validateSession();
        const nextSession = {
          accessToken: storedSession.accessToken,
          user: validatedUser,
        };

        await sessionStorage.saveSession(nextSession);
        setSession(nextSession);
      } catch (error) {
        if (isApiError(error) && error.code === 'unauthorized') {
          await sessionStorage.clearSession();
          setSession(null);
          setAuthError('Tu sesión expiró. Inicia sesión nuevamente.');
          return;
        }

        setSession(storedSession);
        setAuthError(null);
      } finally {
        setIsRestoringSession(false);
      }
    }

    void restoreSession();
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    void registerPushNotifications('cliente');
  }, [session?.accessToken]);

  async function handleLogout() {
    await sessionStorage.clearSession();
    setSession(null);
  }

  async function handleGoogleLogin(idToken: string) {
    setIsAuthenticating(true);
    setAuthError(null);

    try {
      const nextSession = await authApi.googleLogin({
        idToken,
        role: 'CUSTOMER',
        termsAccepted: true,
        termsVersion: CURRENT_TERMS_VERSION,
        termsApp: 'cliente',
      });
      await sessionStorage.saveSession(nextSession);
      setSession(nextSession);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'No se pudo iniciar sesión con Google');
    } finally {
      setIsAuthenticating(false);
    }
  }

  if (isRestoringSession) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea}>
          <StateView title="Cargando RapiV" message="Estamos restaurando tu sesión." type="loading" />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (!session) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar style="dark" />
          <LoginScreen
            error={authError}
            isLoading={isAuthenticating}
            onGoogleLogin={handleGoogleLogin}
            onGoogleError={setAuthError}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  const roles = session.user.roles ?? [];

  if (!roles.includes('CUSTOMER')) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar style="dark" />
          <StateView
            actionLabel="Cerrar sesión"
            message="Este correo pertenece a otra app de RapiV. Usa una cuenta de cliente para entrar aqui."
            onAction={handleLogout}
            title="Cuenta no valida"
            type="error"
          />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <CartProvider>
        <NavigationContainer>
          <StatusBar style="dark" />
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Products" component={ProductsScreen} />
            <Stack.Screen name="Cart" component={CartScreen} />
            <Stack.Screen name="Orders" component={OrdersScreen} />
            <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
            <Stack.Screen name="Profile" options={{ headerShown: false }}>
              {(props) => <ProfileScreen {...props} onLogout={handleLogout} />}
            </Stack.Screen>
          </Stack.Navigator>
        </NavigationContainer>
      </CartProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
