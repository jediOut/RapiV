import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CustomerTabBar } from '../../components/CustomerTabBar';
import { StateView } from '../../components/StateView';
import { colors } from '../../theme/colors';
import { businessApi } from '../../services/businessApi';
import { Business, Product } from '../../types/business';
import { RootStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const quickFilters = ['Tacos', 'Pizza', 'Cafe', 'Hamburguesa', 'Postres'];

export default function HomeScreen({ navigation }: Props) {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);

  useEffect(() => {
    loadMarketplace();
  }, []);

  const loadMarketplace = async () => {
    try {
      setLoading(true);
      setError(null);
      const [nextBusinesses, nextProducts] = await Promise.all([
        businessApi.getBusinesses(),
        businessApi.getProducts(),
      ]);
      setBusinesses(nextBusinesses);
      setProducts(nextProducts);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo cargar el inicio');
    } finally {
      setLoading(false);
    }
  };

  const normalizedQuery = query.trim().toLowerCase();
  const activeFilter = selectedFilter?.toLowerCase();
  const filteredBusinesses = useMemo(
    () =>
      businesses.filter((business) => {
        const haystack = [business.name, business.description, business.address]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        const matchesQuery = normalizedQuery ? haystack.includes(normalizedQuery) : true;
        const matchesFilter = activeFilter ? haystack.includes(activeFilter) : true;
        return matchesQuery && matchesFilter;
      }),
    [activeFilter, businesses, normalizedQuery]
  );
  const highlightedProducts = products
    .filter((product) => product.available)
    .filter((product) => {
      const haystack = [product.name, product.category, product.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const matchesQuery = normalizedQuery ? haystack.includes(normalizedQuery) : true;
      const matchesFilter = activeFilter ? haystack.includes(activeFilter) : true;
      return matchesQuery && matchesFilter;
    })
    .slice(0, 12);

  if (loading) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <StateView title="Cargando RapiV" message="Estamos preparando negocios y novedades." type="loading" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <StateView
          actionLabel="Reintentar"
          message={error}
          onAction={loadMarketplace}
          title={error.includes('Sin conexion') ? 'Sin conexión' : 'No pudimos cargar el inicio'}
          type="error"
        />
        <CustomerTabBar active="home" navigation={navigation} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <View style={styles.brandHeader}>
            <Image source={require("../../../assets/icon.png")} style={styles.headerLogo} />
            <View>
              <Text style={styles.greeting}>RapiV</Text>
              <Text style={styles.location}>Comida cerca de ti</Text>
            </View>
          </View>
          <Pressable onPress={() => navigation.navigate('Profile')} style={styles.profileButton}>
            <MaterialIcons name="person" size={22} color={colors.primary} />
          </Pressable>
        </View>

        <View style={styles.searchBox}>
          <MaterialIcons name="search" size={22} color={colors.textSecondary} />
          <TextInput
            onChangeText={setQuery}
            placeholder="Buscar comida o negocio"
            placeholderTextColor={colors.textSecondary}
            style={styles.searchInput}
            value={query}
          />
        </View>

        <ScrollView
          contentContainerStyle={styles.filterRow}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {quickFilters.map((filter) => {
            const isSelected = selectedFilter === filter;
            return (
              <Pressable
                key={filter}
                onPress={() => setSelectedFilter(isSelected ? null : filter)}
                style={[styles.filterChip, isSelected && styles.selectedFilterChip]}
              >
                <Text style={[styles.filterText, isSelected && styles.selectedFilterText]}>
                  {filter}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>Novedades para ordenar hoy</Text>
            <Text style={styles.heroText}>Explora productos recientes, negocios abiertos y tus favoritos locales.</Text>
          </View>
          <View style={styles.heroIcon}>
            <MaterialIcons name="local-fire-department" size={34} color={colors.surface} />
          </View>
        </View>

        <SectionHeader title="Productos populares" action="Ver negocios" onPress={() => setSelectedFilter(null)} />
        {highlightedProducts.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productCarousel}>
            {highlightedProducts.map((product) => (
              <Pressable
                key={product.id}
                onPress={() => navigation.navigate('Products', { businessId: product.businessId })}
                style={styles.productTile}
              >
                {product.image ? (
                  <Image source={{ uri: product.image }} style={styles.productImage} />
                ) : (
                  <View style={styles.productImageFallback}>
                    <MaterialIcons name="restaurant" size={30} color={colors.primary} />
                  </View>
                )}
                <Text numberOfLines={1} style={styles.productName}>{product.name}</Text>
                <Text numberOfLines={1} style={styles.productMeta}>{product.category ?? 'Comida'}</Text>
                <Text style={styles.productPrice}>${(product.priceCents / 100).toFixed(2)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.inlineState}>
            <Text style={styles.inlineStateTitle}>Sin productos</Text>
            <Text style={styles.inlineStateText}>Aún no hay productos destacados.</Text>
          </View>
        )}

        <SectionHeader title="Negocios cerca" />
        {filteredBusinesses.length ? (
          <View style={styles.businessGrid}>
            {filteredBusinesses.map((business) => (
              <Pressable
                key={business.id}
                onPress={() => navigation.navigate('Products', { businessId: business.id })}
                style={styles.businessTile}
              >
                {business.logo ? (
                  <Image source={{ uri: business.logo }} style={styles.businessImage} />
                ) : (
                  <View style={styles.businessImageFallback}>
                    <MaterialIcons name="storefront" size={30} color={colors.primary} />
                  </View>
                )}
                <View style={styles.businessInfo}>
                  <Text numberOfLines={1} style={styles.businessName}>{business.name}</Text>
                  <Text numberOfLines={1} style={styles.businessMeta}>
                    {business.deliveryTime ? `${business.deliveryTime} min` : 'Tiempo por confirmar'} · Envío según zona
                  </Text>
                  <View style={styles.businessMetaRow}>
                    <View style={[styles.businessBadge, business.isOpen === false ? styles.closedBadge : styles.openBadge]}>
                      <Text style={[styles.businessBadgeText, business.isOpen === false ? styles.closedBadgeText : styles.openBadgeText]}>
                        {business.isOpen === false ? 'Cerrado' : 'Abierto'}
                      </Text>
                    </View>
                    <Text style={styles.ratingText}>? Sin valoraciones</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.inlineState}>
            <Text style={styles.inlineStateTitle}>Sin resultados</Text>
            <Text style={styles.inlineStateText}>Prueba con otra busqueda o categoria.</Text>
          </View>
        )}
      </ScrollView>
      <CustomerTabBar active="home" navigation={navigation} />
    </SafeAreaView>
  );
}

function SectionHeader({
  action,
  onPress,
  title,
}: {
  action?: string;
  onPress?: () => void;
  title: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? (
        <Pressable onPress={onPress}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  brandHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  headerLogo: {
    borderRadius: 8,
    height: 44,
    width: 44,
  },
  greeting: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0,
  },
  location: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  profileButton: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 999,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 50,
    paddingHorizontal: 12,
  },
  searchInput: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  filterRow: {
    gap: 8,
    paddingVertical: 14,
  },
  filterChip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  selectedFilterChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  selectedFilterText: {
    color: colors.surface,
  },
  hero: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    padding: 18,
  },
  heroCopy: {
    flex: 1,
    paddingRight: 16,
  },
  heroTitle: {
    color: colors.surface,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0,
  },
  heroText: {
    color: colors.primaryLight,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 6,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    height: 62,
    justifyContent: 'center',
    width: 62,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0,
  },
  sectionAction: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  productCarousel: {
    gap: 12,
    paddingBottom: 18,
  },
  productTile: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    width: 150,
  },
  productImage: {
    backgroundColor: colors.border,
    height: 112,
    width: '100%',
  },
  productImageFallback: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    height: 112,
    justifyContent: 'center',
    width: '100%',
  },
  productName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 10,
    paddingHorizontal: 10,
  },
  productMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
    paddingHorizontal: 10,
  },
  productPrice: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '900',
    padding: 10,
  },
  businessGrid: {
    gap: 12,
  },
  businessTile: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  businessImage: {
    backgroundColor: colors.border,
    height: 92,
    width: 104,
  },
  businessImageFallback: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    height: 92,
    justifyContent: 'center',
    width: 104,
  },
  businessInfo: {
    flex: 1,
    justifyContent: 'center',
    padding: 12,
  },
  businessName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  businessMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  businessMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  businessBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  openBadge: {
    backgroundColor: colors.secondaryLight,
    borderColor: colors.secondaryBorder,
    borderWidth: 1,
  },
  closedBadge: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
    borderWidth: 1,
  },
  businessBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  openBadgeText: {
    color: '#166534',
  },
  closedBadgeText: {
    color: colors.dangerText,
  },
  ratingText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  inlineState: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 18,
  },
  inlineStateTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  inlineStateText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
});
