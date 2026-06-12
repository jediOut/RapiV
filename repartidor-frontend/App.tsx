import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import { StateView } from './src/components/StateView';
import { authApi } from './src/services/authApi';
import { isApiError } from './src/services/apiError';
import { registerPushNotifications } from './src/services/notificationRegistration';
import { sessionStorage } from './src/services/sessionStorage';
import { colors } from './src/theme/colors';
import { CURRENT_TERMS_VERSION } from './src/config/legal';
import type { AuthSession } from './src/types/auth';
import type { RootStackParamList } from './src/types/navigation';

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
        await sessionStorage.clearSession();
        setSession(null);
        setAuthError(
          isApiError(error) && error.code === 'unauthorized'
            ? 'Tu sesion expiro. Inicia sesion nuevamente.'
            : null
        );
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

    void registerPushNotifications('repartidor');
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
        role: 'COURIER',
        termsAccepted: true,
        termsVersion: CURRENT_TERMS_VERSION,
        termsApp: 'repartidor',
      });
      await sessionStorage.saveSession(nextSession);
      setSession(nextSession);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'No se pudo iniciar sesion con Google');
    } finally {
      setIsAuthenticating(false);
    }
  }

  if (isRestoringSession) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea}>
          <StateView title="Cargando RapiV" message="Estamos restaurando tu sesion." type="loading" />
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

  if (!roles.includes('COURIER')) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar style="dark" />
          <StateView
            actionLabel="Cerrar sesion"
            message="Este correo pertenece a otra app de RapiV. Usa una cuenta de repartidor para entrar aqui."
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
      <NavigationContainer>
        <StatusBar style="dark" />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home">
            {() => <HomeScreen onLogout={handleLogout} />}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
