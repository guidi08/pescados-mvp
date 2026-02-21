import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Pressable,
  SafeAreaView,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { supabase } from '../supabaseClient';
import { useBuyer } from '../context/BuyerContext';
import Card from '../components/Card';
import Badge from '../components/Badge';
import { colors, radius, shadow, spacing, textStyle } from '../theme';

type Seller = {
  id: string;
  display_name: string;
  city: string | null;
  state: string | null;
  cutoff_time: string;
  min_order_cents: number;
  shipping_fee_cents: number;
  b2c_enabled: boolean;
  active: boolean;
  logo_url?: string | null;
};

function centsToBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CATEGORY_TILES: Array<{
  key: string;
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  bg: string;
  category?: string;
  freshFilter?: 'fresh' | 'frozen' | 'all';
}> = [
  {
    key: 'pescados',
    title: 'Pescados',
    subtitle: 'Cortes e caixas',
    icon: 'grid-outline',
    bg: '#FF9F0A',
    category: 'Pescados',
    freshFilter: 'all',
  },
  {
    key: 'frutos',
    title: 'Frutos do mar',
    subtitle: 'Camarão, polvo',
    icon: 'water-outline',
    bg: '#0A84FF',
    category: 'Frutos do mar',
    freshFilter: 'all',
  },
  {
    key: 'iguarias',
    title: 'Iguarias',
    subtitle: 'Premium',
    icon: 'sparkles-outline',
    bg: '#34C759',
    category: 'Iguarias',
    freshFilter: 'all',
  },
  {
    key: 'frescos',
    title: 'Frescos',
    subtitle: 'Entrega D+1',
    icon: 'flash-outline',
    bg: colors.brand.primary,
    freshFilter: 'fresh',
  },
  {
    key: 'congelados',
    title: 'Congelados',
    subtitle: 'Estoque',
    icon: 'snow-outline',
    bg: '#5856D6',
    freshFilter: 'frozen',
  },
  {
    key: 'ofertas',
    title: 'Ofertas',
    subtitle: 'Em breve',
    icon: 'pricetag-outline',
    bg: '#111111',
  },
];

function Skeleton({ w, h, r = 12 }: { w: number | string; h: number; r?: number }) {
  return (
    <View
      style={{
        width: w,
        height: h,
        borderRadius: r,
        backgroundColor: colors.neutral['100'],
      }}
    />
  );
}

function SellerMiniCard({ s, onPress }: { s: Seller; onPress: () => void }) {
  const shippingLabel = s.shipping_fee_cents > 0 ? centsToBRL(s.shipping_fee_cents) : 'Grátis';
  const shippingVariant = s.shipping_fee_cents > 0 ? 'neutral' : 'fresh';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: 116,
        paddingVertical: spacing['3'],
        paddingHorizontal: spacing['3'],
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border.subtle,
        backgroundColor: colors.background.surface,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <View style={{ alignItems: 'center', gap: 8 }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.neutral['50'],
            borderWidth: 1,
            borderColor: colors.border.subtle,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={[textStyle('h2'), { color: colors.text.primary }]}>
            {String(s.display_name ?? '?').slice(0, 1).toUpperCase()}
          </Text>
        </View>

        <View style={{ alignItems: 'center' }}>
          <Text
            numberOfLines={2}
            style={[textStyle('caption'), { color: colors.text.primary, textAlign: 'center' }]}
          >
            {s.display_name}
          </Text>
          <View style={{ marginTop: 6 }}>
            <Badge label={shippingLabel} variant={shippingVariant as any} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function SellerRow({ s, onPress }: { s: Seller; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.99 : 1 }] })}
    >
      <Card style={{ padding: spacing['3'] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing['3'] }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: colors.neutral['50'],
              borderWidth: 1,
              borderColor: colors.border.subtle,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={[textStyle('h3'), { color: colors.text.primary }]}>
              {String(s.display_name ?? '?').slice(0, 1).toUpperCase()}
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={textStyle('h3')}>{s.display_name}</Text>
            <Text style={[textStyle('caption'), { color: colors.text.secondary, marginTop: 2 }]}>
              {(s.city ?? 'São Paulo')}
              {s.state ? `/${s.state}` : ''} • Cut-off {s.cutoff_time}
            </Text>

            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: spacing['2'],
                marginTop: spacing['2'],
              }}
            >
              <Badge label={`Mín. ${centsToBRL(s.min_order_cents)}`} variant="neutral" />
              <Badge
                label={s.shipping_fee_cents > 0 ? `Frete ${centsToBRL(s.shipping_fee_cents)}` : 'Frete grátis'}
                variant={s.shipping_fee_cents > 0 ? 'neutral' : 'fresh'}
              />
              {s.b2c_enabled ? <Badge label="B2C" variant="variable" /> : null}
            </View>
          </View>

          <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
        </View>
      </Card>
    </Pressable>
  );
}

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { channel } = useBuyer();

  const [loading, setLoading] = useState(true);
  const [sellers, setSellers] = useState<Seller[]>([]);

  // Micro-entrance animation for the header (leve e suave)
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 240, useNativeDriver: true }).start();
  }, [enter]);

  const enterY = enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });

  async function load() {
    setLoading(true);

    const { data, error } = await supabase
      .from('sellers')
      .select('id,display_name,city,state,cutoff_time,min_order_cents,shipping_fee_cents,b2c_enabled,active,logo_url')
      .eq('active', true)
      .order('display_name', { ascending: true });

    if (!error) {
      const list = (data ?? []) as any as Seller[];
      const filtered = list.filter((s) => {
        if (!s.active) return false;
        if (channel === 'b2c' && !s.b2c_enabled) return false;
        return true;
      });
      setSellers(filtered);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();

    const realtime = supabase
      .channel('realtime-sellers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sellers' }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(realtime);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);

  const latestSellers = useMemo(() => sellers.slice(0, 10), [sellers]);

  // Banner carousel (iFood-like)
  const bannerGap = spacing['3'];
  const bannerWidth = SCREEN_WIDTH - spacing['4'] * 2;
  const bannerHeight = 160;
  const scrollX = useRef(new Animated.Value(0)).current;

  const banners = useMemo(
    () => [
      {
        key: 'lotepro',
        title: 'LotePro',
        subtitle: 'Proteínas com preço de atacado',
        bg: colors.brand.primary,
        onPress: () => navigation.navigate('ProductsTab', { focusSearch: true }),
      },
      {
        key: 'fresh',
        title: 'Frescos D+1',
        subtitle: 'Cut-off por fornecedor',
        bg: '#111111',
        onPress: () => navigation.navigate('ProductsTab', { initialFreshFilter: 'fresh' }),
      },
      {
        key: 'frozen',
        title: 'Congelados',
        subtitle: 'Estoque e caixas',
        bg: '#1F2A44',
        onPress: () => navigation.navigate('ProductsTab', { initialFreshFilter: 'frozen' }),
      },
    ],
    [navigation]
  );

  function openCategory(tile: (typeof CATEGORY_TILES)[number]) {
    if (!tile.category && !tile.freshFilter) return;
    navigation.navigate('ProductsTab', {
      initialCategory: tile.category ?? 'Todos',
      initialFreshFilter: tile.freshFilter ?? 'all',
      focusSearch: false,
    });
  }

  const Header = (
    <Animated.View
      style={{
        opacity: enter,
        transform: [{ translateY: enterY }],
      }}
    >
      <View style={{ paddingHorizontal: spacing['4'], paddingTop: spacing['3'] }}>
        {/* Location (centered like iFood) */}
        <View style={{ height: 44, justifyContent: 'center' }}>
          <View style={{ alignItems: 'center' }}>
            <Pressable
              onPress={() => {
                // MVP: localização fixa
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Text style={textStyle('bodyStrong')}>São Paulo</Text>
              <Ionicons name="chevron-down" size={16} color={colors.text.secondary} />
            </Pressable>
            <Text style={[textStyle('caption'), { color: colors.text.tertiary, marginTop: 2 }]}>
              Capital • Entrega D+1 (conforme cut-off)
            </Text>
          </View>

          <Pressable
            onPress={() => {
              // MVP: notificações em breve
            }}
            hitSlop={10}
            style={({ pressed }) => ({
              position: 'absolute',
              right: 0,
              top: 2,
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? colors.neutral['50'] : 'transparent',
            })}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.text.primary} />
          </Pressable>
        </View>

        {/* Search (Pressable, iFood-like) */}
        <Pressable
          onPress={() => navigation.navigate('ProductsTab', { focusSearch: true })}
          style={({ pressed }) => ({
            marginTop: spacing['3'],
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            borderRadius: 999,
            paddingHorizontal: 14,
            paddingVertical: 12,
            backgroundColor: pressed ? colors.neutral['100'] : colors.neutral['50'],
            borderWidth: 1,
            borderColor: colors.border.subtle,
          })}
        >
          <Ionicons name="search" size={18} color={colors.text.tertiary} />
          <Text style={[textStyle('body'), { color: colors.text.tertiary, flex: 1 }]}>O que vai pedir hoje?</Text>
        </Pressable>
      </View>

      {/* Category tiles */}
      <View style={{ marginTop: spacing['5'], paddingHorizontal: spacing['4'] }}>
        <Text style={textStyle('h2')}>Categorias</Text>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing['3'],
            marginTop: spacing['3'],
          }}
        >
          {CATEGORY_TILES.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => openCategory(t)}
              style={({ pressed }) => ({
                width: '48%',
                borderRadius: 18,
                padding: spacing['3'],
                backgroundColor: t.bg,
                opacity: pressed ? 0.92 : 1,
                transform: [{ scale: pressed ? 0.99 : 1 }],
                overflow: 'hidden',
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={[textStyle('h3'), { color: '#fff' }]}>{t.title}</Text>
                <Ionicons name={t.icon} size={22} color="#fff" />
              </View>
              {t.subtitle ? (
                <Text style={[textStyle('caption'), { color: 'rgba(255,255,255,0.88)', marginTop: 6 }]}>
                  {t.subtitle}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      </View>

      {/* Banners */}
      <View style={{ marginTop: spacing['6'] }}>
        <Animated.FlatList
          data={banners}
          keyExtractor={(b) => b.key}
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={bannerWidth + bannerGap}
          snapToAlignment="start"
          disableIntervalMomentum
          contentContainerStyle={{ paddingHorizontal: spacing['4'] }}
          ItemSeparatorComponent={() => <View style={{ width: bannerGap }} />}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
            useNativeDriver: false,
          })}
          scrollEventThrottle={16}
          renderItem={({ item }) => (
            <Pressable
              onPress={item.onPress}
              style={({ pressed }) => ({
                width: bannerWidth,
                height: bannerHeight,
                borderRadius: 22,
                backgroundColor: item.bg,
                overflow: 'hidden',
                transform: [{ scale: pressed ? 0.995 : 1 }],
              })}
            >
              {/* Simple “graphic” */}
              <View
                style={{
                  position: 'absolute',
                  right: -24,
                  top: -24,
                  width: 120,
                  height: 120,
                  borderRadius: 60,
                  backgroundColor: 'rgba(255,255,255,0.15)',
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  right: 30,
                  bottom: -30,
                  width: 160,
                  height: 160,
                  borderRadius: 80,
                  backgroundColor: 'rgba(0,0,0,0.12)',
                }}
              />

              <View style={{ padding: spacing['5'], flex: 1, justifyContent: 'center' }}>
                <Text style={[textStyle('h1'), { color: '#fff' }]}>{item.title}</Text>
                <Text
                  style={[
                    textStyle('small'),
                    { color: 'rgba(255,255,255,0.9)', marginTop: spacing['1'] },
                  ]}
                >
                  {item.subtitle}
                </Text>

                <View style={{ marginTop: spacing['4'], flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 999,
                      backgroundColor: 'rgba(255,255,255,0.18)',
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.18)',
                    }}
                  >
                    <Text style={[textStyle('caption'), { color: '#fff' }]}>Ver agora</Text>
                  </View>

                  <Ionicons name="chevron-forward" size={18} color="#fff" />
                </View>
              </View>
            </Pressable>
          )}
        />

        {/* Dots */}
        <View style={{ marginTop: spacing['3'], flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
          {banners.map((_, i) => {
            const step = bannerWidth + bannerGap;
            const inputRange = [(i - 1) * step, i * step, (i + 1) * step];
            const w = scrollX.interpolate({
              inputRange,
              outputRange: [6, 18, 6],
              extrapolate: 'clamp',
            });
            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.35, 1, 0.35],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={`dot-${i}`}
                style={{
                  width: w,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: colors.brand.primary,
                  opacity,
                }}
              />
            );
          })}
        </View>
      </View>

      {/* Últimas lojas */}
      <View style={{ marginTop: spacing['6'], paddingHorizontal: spacing['4'] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={textStyle('h2')}>Últimas lojas</Text>
          <Pressable
            onPress={() => {
              // MVP: já mostramos a lista completa abaixo
            }}
          >
            <Text style={[textStyle('body'), { color: colors.brand.primary }]}>Ver mais</Text>
          </Pressable>
        </View>
      </View>

      <View style={{ marginTop: spacing['3'] }}>
        {loading ? (
          <View style={{ flexDirection: 'row', gap: spacing['3'], paddingHorizontal: spacing['4'] }}>
            <Skeleton w={116} h={132} r={16} />
            <Skeleton w={116} h={132} r={16} />
            <Skeleton w={116} h={132} r={16} />
          </View>
        ) : (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={latestSellers}
            keyExtractor={(s) => s.id}
            contentContainerStyle={{ paddingHorizontal: spacing['4'], gap: spacing['3'] }}
            renderItem={({ item }) => (
              <SellerMiniCard
                s={item}
                onPress={() => navigation.navigate('Seller', { sellerId: item.id, sellerName: item.display_name })}
              />
            )}
          />
        )}

        {channel === 'b2c' ? (
          <View style={{ paddingHorizontal: spacing['4'], marginTop: spacing['2'] }}>
            <Text style={[textStyle('caption'), { color: colors.text.tertiary }]}>
              Mostrando apenas fornecedores com logística B2C.
            </Text>
          </View>
        ) : null}
      </View>

      {/* Section title */}
      <View
        style={{
          marginTop: spacing['6'],
          paddingHorizontal: spacing['4'],
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text style={textStyle('h2')}>Fornecedores</Text>
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: colors.neutral['50'],
            borderWidth: 1,
            borderColor: colors.border.subtle,
          }}
        >
          <Text style={[textStyle('caption'), { color: colors.text.secondary }]}>
            {channel === 'b2b' ? 'B2B' : 'B2C'}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: spacing['4'], marginTop: spacing['3'], gap: spacing['3'] }}>
          <Skeleton w={'100%'} h={78} r={16} />
          <Skeleton w={'100%'} h={78} r={16} />
          <Skeleton w={'100%'} h={78} r={16} />
        </View>
      ) : null}
    </Animated.View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.app }}>
      <FlatList
        data={loading ? [] : sellers}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ paddingBottom: 160, gap: spacing['3'] }}
        ListHeaderComponent={Header}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: spacing['4'] }}>
            <SellerRow
              s={item}
              onPress={() => navigation.navigate('Seller', { sellerId: item.id, sellerName: item.display_name })}
            />
          </View>
        )}
        ListEmptyComponent={!loading ? (
          <Text style={{ paddingHorizontal: spacing['4'], paddingVertical: spacing['5'], color: colors.text.secondary }}>
            Nenhum fornecedor disponível.
          </Text>
        ) : null}
      />
    </SafeAreaView>
  );
}
