import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

type StateViewProps = {
  actionLabel?: string;
  message: string;
  onAction?: () => void;
  title: string;
  type?: 'loading' | 'empty' | 'error';
};

export function StateView({
  actionLabel,
  message,
  onAction,
  title,
  type = 'empty',
}: StateViewProps) {
  return (
    <View style={styles.container}>
      {type === 'loading' ? <ActivityIndicator size="large" color={colors.primary} /> : null}
      <Text style={[styles.title, type === 'error' && styles.errorTitle]}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={styles.button}>
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 12,
    textAlign: 'center',
  },
  errorTitle: {
    color: colors.danger,
  },
  message: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  buttonText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '800',
  },
});
