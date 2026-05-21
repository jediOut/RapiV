import { StyleSheet, Text, View } from "react-native";

import PrimaryButton from "../components/PrimaryButton";
import { colors } from "../theme/colors";

type ProfileSwitchNoticeScreenProps = {
  profileName: string;
  onContinue: () => void;
  onLogout: () => void;
};

export function ProfileSwitchNoticeScreen({
  profileName,
  onContinue,
  onLogout
}: ProfileSwitchNoticeScreenProps) {
  return (
    <View style={styles.container}>
      <View style={styles.panel}>
        <Text style={styles.brand}>RapiV</Text>
        <Text style={styles.title}>Cambio de perfil</Text>
        <Text style={styles.body}>
          Estas iniciando sesion en la app de repartidores con un perfil de {profileName}. Si
          continuas, la sesion quedara activa aqui como repartidor.
        </Text>
        <Text style={styles.body}>
          Para volver a tomar tu perfil original tendras que cerrar sesion e iniciar sesion en su
          aplicacion correspondiente.
        </Text>
        <View style={styles.actions}>
          <PrimaryButton title="Continuar como repartidor" onPress={onContinue} />
          <PrimaryButton title="Cerrar sesion" onPress={onLogout} variant="secondary" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: "center",
    padding: 22
  },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 18
  },
  brand: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 0
  },
  body: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22
  },
  actions: {
    gap: 12,
    marginTop: 4
  }
});
