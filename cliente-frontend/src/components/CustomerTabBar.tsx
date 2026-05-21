import { MaterialIcons } from '@expo/vector-icons';
import type { NavigationProp } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCart } from '../context/CartContext';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../types/navigation';

type TabKey = 'home' | 'orders' | 'cart' | 'profile';

type CustomerTabBarProps = {
  active: TabKey;
  navigation: NavigationProp<RootStackParamList>;
};

const tabs: Array<{
  key: TabKey;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  route: keyof RootStackParamList;
}> = [
  { key: 'home', label: 'Inicio', icon: 'storefront', route: 'Home' },
  { key: 'orders', label: 'Pedidos', icon: 'receipt-long', route: 'Orders' },
  { key: 'cart', label: 'Carrito', icon: 'shopping-bag', route: 'Cart' },
  { key: 'profile', label: 'Perfil', icon: 'person', route: 'Profile' },
];

export function CustomerTabBar({ active, navigation }: CustomerTabBarProps) {
  const { itemCount } = useCart();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {tabs.map((tab) => {
        const isActive = active === tab.key;
        const count = tab.key === 'cart' ? itemCount : 0;

        return (
          <Pressable
            key={tab.key}
            onPress={() => navigation.navigate(tab.route as never)}
            style={styles.tab}
          >
            <View style={[styles.iconWrap, isActive && styles.activeIconWrap]}>
              <MaterialIcons
                color={isActive ? colors.surface : colors.textSecondary}
                name={tab.icon}
                size={22}
              />
              {count > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.label, isActive && styles.activeLabel]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  tab: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 999,
    height: 34,
    justifyContent: 'center',
    position: 'relative',
    width: 48,
  },
  activeIconWrap: {
    backgroundColor: colors.primary,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  activeLabel: {
    color: colors.primary,
  },
  badge: {
    alignItems: 'center',
    backgroundColor: colors.dangerText,
    borderRadius: 999,
    minWidth: 18,
    paddingHorizontal: 4,
    paddingVertical: 1,
    position: 'absolute',
    right: 3,
    top: -2,
  },
  badgeText: {
    color: colors.surface,
    fontSize: 10,
    fontWeight: '900',
  },
});
