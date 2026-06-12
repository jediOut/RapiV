import { useEffect, useRef, useState } from "react";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme/colors";

WebBrowser.maybeCompleteAuthSession();

type GoogleSignInButtonProps = {
  disabled?: boolean;
  onToken: (idToken: string) => Promise<void> | void;
  onError: (message: string) => void;
};

const missingGoogleClientId = "missing-google-client-id.apps.googleusercontent.com";

function envClientId(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

const configuredGoogleClientIds = {
  webClientId: envClientId(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID),
  iosClientId: envClientId(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID),
  androidClientId: envClientId(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID)
};

const googleClientIds = {
  webClientId: configuredGoogleClientIds.webClientId ?? missingGoogleClientId,
  iosClientId: configuredGoogleClientIds.iosClientId ?? missingGoogleClientId,
  androidClientId: configuredGoogleClientIds.androidClientId ?? missingGoogleClientId
};

const nativeRedirectUri = Platform.select({
  android: "com.rapiv.courier:/oauthredirect",
  ios: "com.rapiv.courier:/oauthredirect",
  default: undefined
});

function currentPlatformClientId() {
  if (Platform.OS === "ios") {
    return configuredGoogleClientIds.iosClientId;
  }

  if (Platform.OS === "android") {
    return configuredGoogleClientIds.androidClientId;
  }

  return configuredGoogleClientIds.webClientId;
}

function missingConfigMessage() {
  if (Platform.OS === "ios") {
    return "Google no esta configurado para iOS.";
  }

  if (Platform.OS === "android") {
    return "Google no esta configurado para Android.";
  }

  return "Google aun no esta configurado para esta app.";
}

export function GoogleSignInButton({ disabled = false, onToken, onError }: GoogleSignInButtonProps) {
  const [isPrompting, setIsPrompting] = useState(false);
  const handledTokenRef = useRef<string | null>(null);
  const [request, response, promptAsync] = Google.useAuthRequest({
    ...googleClientIds,
    ...(nativeRedirectUri ? { redirectUri: nativeRedirectUri } : {}),
    scopes: ["openid", "profile", "email"]
  });
  const isConfigured = Boolean(currentPlatformClientId());
  const isDisabled = disabled || isPrompting || !request || !isConfigured;

  useEffect(() => {
    if (!response) {
      return;
    }

    setIsPrompting(false);

    if (response.type === "success") {
      const idToken = response.authentication?.idToken ?? response.params?.id_token;

      if (!idToken) {
        onError("Google no devolvio un token valido.");
        return;
      }

      if (handledTokenRef.current === idToken) {
        return;
      }

      handledTokenRef.current = idToken;
      void onToken(idToken);
      return;
    }

    if (response.type === "error") {
      onError("No se pudo iniciar sesion con Google.");
    }
  }, [onError, onToken, response]);

  return (
    <View style={styles.wrapper}>
      <Pressable
        disabled={isDisabled}
        onPress={() => {
          handledTokenRef.current = null;
          setIsPrompting(true);
          void promptAsync();
        }}
        style={[styles.button, isDisabled && styles.disabledButton]}
      >
        <Text style={styles.googleMark}>G</Text>
        <Text style={styles.buttonText}>{isPrompting ? "Conectando..." : "Continuar con Google"}</Text>
      </Pressable>
      {!isConfigured ? (
        <Text style={styles.notice}>{missingConfigMessage()}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8
  },
  button: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: 16
  },
  disabledButton: {
    opacity: 0.55
  },
  googleMark: {
    color: "#1D4ED8",
    fontSize: 17,
    fontWeight: "900"
  },
  buttonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800"
  },
  notice: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
    textAlign: "center"
  }
});
