import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { SafeAreaView, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import {
  loginBusinessUserWithGoogle,
  validateSession
} from "./src/services/authApi";
import { isApiError } from "./src/services/apiError";
import { registerPushNotifications } from "./src/services/notificationRegistration";
import { clearSession, loadSession, saveSession } from "./src/services/sessionStorage";
import { BusinessApp } from "./src/screens/BusinessApp";
import { StateView } from "./src/components/StateView";
import { LoginScreen } from "./src/screens/LoginScreen";
import { colors } from "./src/theme/colors";
import type { AuthSession } from "./src/types/auth";

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  useEffect(() => {
    async function restoreSession() {
      const storedSession = await loadSession();

      if (!storedSession) {
        setIsRestoringSession(false);
        return;
      }

      try {
        const validSession = await validateSession(storedSession);
        await saveSession(validSession);
        setSession(validSession);
      } catch (error) {
        await clearSession();
        setSession(null);
        setAuthError(
          isApiError(error) && error.code === "unauthorized"
            ? "Tu sesión expiró. Inicia sesión nuevamente."
            : null
        );
      }

      setIsRestoringSession(false);
    }

    void restoreSession();
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    void registerPushNotifications("negocio");
  }, [session?.accessToken]);

  async function handleGoogleLogin(idToken: string) {
    setIsAuthenticating(true);
    setAuthError(null);

    try {
      const nextSession = await loginBusinessUserWithGoogle(idToken);
      await saveSession(nextSession);
      setSession(nextSession);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "No se pudo iniciar sesión con Google");
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function handleLogout() {
    await clearSession();
    setSession(null);
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

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        {session && !(session.user.roles ?? []).includes("BUSINESS_OWNER") ? (
          <StateView
            actionLabel="Cerrar sesión"
            message="Este correo pertenece a otra app de RapiV. Usa una cuenta de negocio para entrar aqui."
            onAction={handleLogout}
            title="Cuenta no valida"
            type="error"
          />
        ) : session ? (
          <BusinessApp session={session} onLogout={handleLogout} />
        ) : (
          <LoginScreen
            error={authError}
            isLoading={isAuthenticating}
            onGoogleLogin={handleGoogleLogin}
            onGoogleError={setAuthError}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
});
