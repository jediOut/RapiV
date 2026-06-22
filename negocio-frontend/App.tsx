import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { SafeAreaView, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import {
  loginBusinessUserWithGoogle,
  validateSession
} from "./src/services/authApi";
import { isApiError } from "./src/services/apiError";
import { identifyCrashUser, logCrashBreadcrumb, recordNonFatalError } from "./src/services/crashReporting";
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
        identifyCrashUser(validSession.user.id ?? validSession.user.email, { email: validSession.user.email });
        logCrashBreadcrumb("negocio_session_restored");
      } catch (error) {
        if (isApiError(error) && error.code === "unauthorized") {
          await clearSession();
          setSession(null);
          setAuthError("Tu sesion expiro. Inicia sesion nuevamente.");
          return;
        }

        setSession(storedSession);
        setAuthError(null);
        identifyCrashUser(storedSession.user.id ?? storedSession.user.email, { email: storedSession.user.email });
        recordNonFatalError(error, { flow: "negocio_restore_session" });
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

    identifyCrashUser(session.user.id ?? session.user.email, { email: session.user.email });
    void registerPushNotifications("negocio").catch((error) => {
      recordNonFatalError(error, { flow: "negocio_register_push" });
      console.warn("No se pudo registrar push de negocio", error);
    });
  }, [session?.accessToken]);

  async function handleGoogleLogin(idToken: string) {
    setIsAuthenticating(true);
    setAuthError(null);

    try {
      const nextSession = await loginBusinessUserWithGoogle(idToken);
      await saveSession(nextSession);
      setSession(nextSession);
      identifyCrashUser(nextSession.user.id ?? nextSession.user.email, { email: nextSession.user.email });
      logCrashBreadcrumb("negocio_google_login_success");
    } catch (error) {
      recordNonFatalError(error, { flow: "negocio_google_login" });
      setAuthError(error instanceof Error ? error.message : "No se pudo iniciar sesion con Google");
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
          <StateView title="Cargando RapiV" message="Estamos restaurando tu sesion." type="loading" />
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
            actionLabel="Cerrar sesion"
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
