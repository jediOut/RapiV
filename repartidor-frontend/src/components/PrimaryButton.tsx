import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
}

const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  title,
  onPress,
  disabled = false,
  variant = 'primary'
}) => {
  const isSecondary = variant === 'secondary';

  return (
    <TouchableOpacity
      style={[
        styles.button,
        isSecondary && styles.secondaryButton,
        disabled && styles.buttonDisabled
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={disabled ? 1 : 0.7}
    >
      <Text style={[styles.text, isSecondary && styles.secondaryText]}>{title}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
  },
  text: {
    color: 'white',
    fontSize: 16,
  },
  secondaryText: {
    color: colors.primary,
  },
  buttonDisabled: {
    backgroundColor: '#A1A1AA',
  },
});

export default PrimaryButton;
