import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

interface HeaderProps {
  title: string;
  onBackPress?: () => void;
  rightIcon?: string;
  onRightPress?: () => void;
}

export default function Header({
  title,
  onBackPress,
  rightIcon,
  onRightPress,
}: HeaderProps) {
  return (
    <View style={styles.header}>
      {onBackPress ? (
        <TouchableOpacity onPress={onBackPress} style={styles.iconButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
      ) : (
        <View style={styles.iconButton} />
      )}

      <Text style={styles.title}>{title}</Text>

      {rightIcon ? (
        <TouchableOpacity onPress={onRightPress} style={styles.iconButton}>
          <MaterialIcons name={rightIcon as any} size={24} color={colors.text} />
        </TouchableOpacity>
      ) : (
        <View style={styles.iconButton} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
