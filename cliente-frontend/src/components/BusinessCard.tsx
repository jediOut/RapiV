import React from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { Business } from '../types/business';

interface BusinessCardProps {
  business: Business;
  onPress: () => void;
}

export default function BusinessCard({ business, onPress }: BusinessCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      {business.logo && (
        <Image
          source={{ uri: business.logo }}
          style={styles.logo}
        />
      )}
      <View style={styles.content}>
        <Text style={styles.name}>{business.name}</Text>
        {business.description && (
          <Text style={styles.description} numberOfLines={1}>
            {business.description}
          </Text>
        )}
        <View style={styles.footer}>
          {business.rating && (
            <View style={styles.ratingContainer}>
              <MaterialIcons name="star" size={14} color={colors.warning} />
              <Text style={styles.rating}>{business.rating}</Text>
            </View>
          )}
          {business.deliveryTime && (
            <View style={styles.deliveryContainer}>
              <MaterialIcons name="schedule" size={14} color={colors.textSecondary} />
              <Text style={styles.deliveryTime}>{business.deliveryTime} min</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logo: {
    width: '100%',
    height: 150,
    backgroundColor: colors.surface,
  },
  content: {
    padding: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rating: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
  },
  deliveryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deliveryTime: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
