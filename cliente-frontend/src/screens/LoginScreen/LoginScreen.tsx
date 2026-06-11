import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';

import { GoogleSignInButton } from '../../components/GoogleSignInButton';
import { CURRENT_TERMS_VERSION, CUSTOMER_TERMS_SECTIONS, CUSTOMER_TERMS_TITLE } from '../../config/legal';
import { colors } from '../../theme/colors';

type LoginScreenProps = {
  error: string | null;
  isLoading: boolean;
  onGoogleLogin: (idToken: string) => Promise<void> | void;
  onGoogleError: (message: string) => void;
};

export function LoginScreen({
  error,
  isLoading,
  onGoogleLogin,
  onGoogleError
}: LoginScreenProps) {
  const [areTermsVisible, setAreTermsVisible] = useState(false);

  return (
    <>
      <ScrollView contentContainerStyle={loginStyles.container} keyboardShouldPersistTaps="handled">
        <View style={loginStyles.brandBlock}>
          <Text style={loginStyles.brand}>RapiV</Text>
          <Text style={loginStyles.title}>Acceso para clientes</Text>
          <Text style={loginStyles.subtitle}>Entra con Google para ordenar y recibir tu pedido a tiempo.</Text>
        </View>

        <View style={loginStyles.form}>
          {error ? <Text style={loginStyles.errorText}>{error}</Text> : null}
          <GoogleSignInButton
            disabled={isLoading}
            onError={onGoogleError}
            onToken={onGoogleLogin}
          />
          <Text style={loginStyles.termsText}>
            Al continuar con Google aceptas los{' '}
            <Text onPress={() => setAreTermsVisible(true)} style={loginStyles.termsLink}>
              terminos y condiciones
            </Text>{' '}
            de RapiV Cliente.
          </Text>
        </View>
      </ScrollView>

      <Modal
        animationType="slide"
        onRequestClose={() => setAreTermsVisible(false)}
        transparent
        visible={areTermsVisible}
      >
        <View style={loginStyles.modalBackdrop}>
          <View style={loginStyles.modalSheet}>
            <View style={loginStyles.modalHeader}>
              <View style={loginStyles.modalTitleBlock}>
                <Text style={loginStyles.modalTitle}>{CUSTOMER_TERMS_TITLE}</Text>
                <Text style={loginStyles.modalVersion}>Version {CURRENT_TERMS_VERSION}</Text>
              </View>
              <Pressable
                accessibilityLabel="Cerrar terminos"
                onPress={() => setAreTermsVisible(false)}
                style={loginStyles.closeButton}
              >
                <Text style={loginStyles.closeButtonText}>X</Text>
              </Pressable>
            </View>

            <ScrollView style={loginStyles.termsScroll} showsVerticalScrollIndicator>
              {CUSTOMER_TERMS_SECTIONS.map((section, index) => (
                <View key={section.title} style={loginStyles.termSection}>
                  <Text style={loginStyles.termSectionTitle}>
                    {index + 1}. {section.title}
                  </Text>
                  <Text style={loginStyles.termSectionBody}>{section.body}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const loginStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flexGrow: 1,
    justifyContent: "center",
    padding: 22
  },
  brandBlock: {
    marginBottom: 28
  },
  brand: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 0,
    marginTop: 8
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8
  },
  form: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 16,
    padding: 16
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18
  },
  termsText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    textAlign: "center"
  },
  termsLink: {
    color: colors.primary,
    textDecorationLine: "underline"
  },
  modalBackdrop: {
    backgroundColor: "rgba(15, 23, 42, 0.42)",
    flex: 1,
    justifyContent: "flex-end"
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    maxHeight: "86%",
    paddingBottom: 20
  },
  modalHeader: {
    alignItems: "flex-start",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    padding: 18
  },
  modalTitleBlock: {
    flex: 1
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 24
  },
  modalVersion: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4
  },
  closeButton: {
    alignItems: "center",
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryBorder,
    borderRadius: 8,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  closeButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "900"
  },
  termsScroll: {
    paddingHorizontal: 18
  },
  termSection: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingVertical: 14
  },
  termSectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 20
  },
  termSectionBody: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
    marginTop: 6
  }
});
