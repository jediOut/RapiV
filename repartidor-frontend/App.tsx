import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
import { StateView } from './src/components/StateView';
import { ProfileSwitchNoticeScreen } from './src/screens/ProfileSwitchNoticeScreen';
import { authApi } from './src/services/authApi';
import { isApiError } from './src/services/apiError';
import { registerPushNotifications } from './src/services/notificationRegistration';
import { sessionStorage } from './src/services/sessionStorage';
import { colors } from './src/theme/colors';
import type { AuthSession, LoginPayload, RegisterPayload } from './src/types/auth';
import type { RootStackParamList } from './src/types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

type AuthScreen = 'login' | 'register';

export default function App() {
  const [authScreen, setAuthScreen] = useState<AuthScreen>('login');
  const [session, setSession] = useState<AuthSession | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [hasConfirmedProfileSwitch, setHasConfirmedProfileSwitch] = useState(false);

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
        setHasConfirmedProfileSwitch(false);
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

  async function handleLogin(email: string, password: string) {
    setIsAuthenticating(true);
    setAuthError(null);

    try {
      const nextSession = await authApi.login({ email, password });
      await sessionStorage.saveSession(nextSession);
      setSession(nextSession);
      setHasConfirmedProfileSwitch(false);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'No se pudo iniciar sesión');
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function handleRegister(payload: RegisterPayload) {
    setIsAuthenticating(true);
    setAuthError(null);

    try {
      const nextSession = await authApi.register(payload);
      await sessionStorage.saveSession(nextSession);
      setSession(nextSession);
      setHasConfirmedProfileSwitch(false);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'No se pudo crear la cuenta');
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function handleLogout() {
    await sessionStorage.clearSession();
    setSession(null);
    setHasConfirmedProfileSwitch(false);
    setAuthScreen('login');
  }

  if (isRestoringSession) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StateView title="Cargando RapiV" message="Estamos restaurando tu sesion." type="loading" />
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        {authScreen === 'login' ? (
          <LoginScreen
            error={authError}
            isLoading={isAuthenticating}
            onLogin={handleLogin}
            onCreateAccount={() => {
              setAuthError(null);
              setAuthScreen('register');
            }}
          />
        ) : (
          <RegisterScreen
            error={authError}
            isLoading={isAuthenticating}
            onRegister={handleRegister}
            onBackToLogin={() => {
              setAuthError(null);
              setAuthScreen('login');
            }}
          />
        )}
      </SafeAreaView>
    );
  }

  const roles = session.user.roles ?? [];
  const isCourierProfile = roles.includes('COURIER');
  const sourceProfile = roles.includes('BUSINESS_OWNER')
    ? 'negocio'
    : roles.includes('CUSTOMER')
      ? 'cliente'
      : 'otro tipo';

  if (!isCourierProfile && !hasConfirmedProfileSwitch) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <ProfileSwitchNoticeScreen
          profileName={sourceProfile}
          onContinue={() => setHasConfirmedProfileSwitch(true)}
          onLogout={handleLogout}
        />
      </SafeAreaView>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home">
          {() => <HomeScreen onLogout={handleLogout} />}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
