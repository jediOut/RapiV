import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { SafeAreaView, StyleSheet } from "react-native";

import { loginBusinessUser, registerBusinessUser, validateSession } from "./src/services/authApi";
import { isApiError } from "./src/services/apiError";
import { registerPushNotifications } from "./src/services/notificationRegistration";
import { clearSession, loadSession, saveSession } from "./src/services/sessionStorage";
import { BusinessApp } from "./src/screens/BusinessApp";
import { StateView } from "./src/components/StateView";
import { LoginScreen } from "./src/screens/LoginScreen";
import { RegisterScreen } from "./src/screens/RegisterScreen";
import { colors } from "./src/theme/colors";
import type { AuthSession, LoginPayload, RegisterBusinessPayload } from "./src/types/auth";
import type { AuthScreen } from "./src/types/navigation";

export default function App() {
  const [authScreen, setAuthScreen] = useState<AuthScreen>("login");
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
            ? "Tu sesion expiro. Inicia sesion nuevamente."
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

  async function handleLogin(payload: LoginPayload) {
    setIsAuthenticating(true);
    setAuthError(null);

    try {
      const nextSession = await loginBusinessUser(payload);
      await saveSession(nextSession);
      setSession(nextSession);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "No se pudo iniciar sesion");
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function handleRegister(payload: RegisterBusinessPayload) {
    setIsAuthenticating(true);
    setAuthError(null);

    try {
      const nextSession = await registerBusinessUser(payload);
      await saveSession(nextSession);
      setSession(nextSession);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "No se pudo crear la cuenta");
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
      <SafeAreaView style={styles.safeArea}>
        <StateView title="Cargando RapiV" message="Estamos restaurando tu sesion." type="loading" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      {session ? (
        <BusinessApp session={session} onLogout={handleLogout} />
      ) : authScreen === "login" ? (
        <LoginScreen
          error={authError}
          isLoading={isAuthenticating}
          onLogin={handleLogin}
          onCreateAccount={() => setAuthScreen("register")}
        />
      ) : (
        <RegisterScreen
          error={authError}
          isLoading={isAuthenticating}
          onRegister={handleRegister}
          onBackToLogin={() => {
            setAuthError(null);
            setAuthScreen("login");
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
});
