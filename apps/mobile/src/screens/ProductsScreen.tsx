import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

import { supabase } from '../supabaseClient';
import { useBuyer } from '../context/BuyerContext';
import Card from '../components/Card';
import Badge from '../components/Badge';
import { colors, spacing, textStyle } from '../theme';

type Product = {
  id: string;
  seller_id: string;
  name: string;
  category: string | null;
  fresh: boolean;
  active: boolean;
  base_price_cents: number;
  unit: string;
  pricing_mode: 'per_unit' | 'per_kg_box';
  estimated_box_weight_kg: number | null;
  max_weight_variation_pct: number | null;
};

type Seller = {
  id: string;
  display_name: string;
  b2c_enabled: boolean;
};

function centsToBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function ProductRow({ p, sellerName, onPress }: { p: Product; sellerName?: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <Card style={{ padding: spacing['3'] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing['3'] }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: colors.background.app,
              borderWidth: 1,
              borderColor: colors.border.subtle,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={p.fresh ? 'flash' : 'snow'} size={18} color={colors.text.primary} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={textStyle('h3')}>{p.name}</Text>
            <Text style={[textStyle('caption'), { color: colors.text.secondary, marginTop: 2 }]}
            >
              {sellerName ? `${sellerName} • ` : ''}{p.category ?? '—'}
            </Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing['2'], marginTop: spacing['2'] }}>
              <Badge label={p.fresh ? 'Fresco' : 'Congelado'} variant={p.fresh ? 'fresh' : 'neutral'} />
              <Badge
                label={
                  p.pricing_mode === 'per_kg_box'
                    ? `${centsToBRL(p.base_price_cents)}/kg`
                    : `${centsToBRL(p.base_price_cents)}/${p.unit}`
                }
                variant="neutral"
              />
              {p.pricing_mode === 'per_kg_box' && p.estimated_box_weight_kg ? (
                <Badge label={`~${p.estimated_box_weight_kg}kg/cx`} variant="variable" />
              ) : null}
            </View>
          </View>

          <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
        </View>
      </Card>
    </TouchableOpacity>
  );
}

export default function ProductsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { channel } = useBuyer();

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [sellersById, setSellersById] = useState<Record<string, Seller>>({});

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('Todos');
  const [freshFilter, setFreshFilter] = useState<'all' | 'fresh' | 'frozen'>('all');

  const inputRef = useRef<TextInput | null>(null);

  // Apply initial params (from Home categories)
  useEffect(() => {
    const initialCategory = route.params?.initialCategory;
    const initialFreshFilter = route.params?.initialFreshFilter;
    if (initialCategory && typeof initialCategory === 'string') setCategory(initialCategory);
    if (initialFreshFilter && ['all', 'fresh', 'frozen'].includes(initialFreshFilter)) {
      setFreshFilter(initialFreshFilter);
    }

    if (route.params?.focusSearch) {
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [route.params?.initialCategory, route.params?.initialFreshFilter, route.params?.focusSearch]);

  async function load() {
    setLoading(true);

    const [{ data: sellerRows }, { data: productRows, error: pErr }] = await Promise.all([
      supabase
        .from('sellers')
        .select('id,display_name,b2c_enabled,active')
        .eq('active', true),
      supabase
        .from('products')
        .select('id,seller_id,name,category,fresh,active,base_price_cents,unit,pricing_mode,estimated_box_weight_kg,max_weight_variation_pct')
        .eq('active', true)
        .order('name', { ascending: true }),
    ]);

    const sellerMap: Record<string, Seller> = {};
    for (const s of (sellerRows ?? []) as any[]) {
      sellerMap[s.id] = s as any;
    }
    setSellersById(sellerMap);

    if (!pErr) {
      let list = (productRows ?? []) as any as Product[];

      // Filter: B2C only sees sellers with b2c_enabled
      if (channel === 'b2c') {
        list = list.filter((p) => sellerMap[p.seller_id]?.b2c_enabled);
      }

      setProducts(list);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();

    const realtime = supabase
      .channel('realtime-products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(realtime);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.category) set.add(p.category);
    }
    return ['Todos', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return products.filter((p) => {
      if (!p.active) return false;
      if (category !== 'Todos' && (p.category ?? '—') !== category) return false;
      if (freshFilter === 'fresh' && !p.fresh) return false;
      if (freshFilter === 'frozen' && p.fresh) return false;

      if (!q) return true;
      const seller = sellersById[p.seller_id]?.display_name ?? '';
      return `${p.name} ${p.category ?? ''} ${seller}`.toLowerCase().includes(q);
    });
  }, [products, query, category, freshFilter, sellersById]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.app }}>
      <View style={{ paddingHorizontal: spacing['4'], paddingTop: spacing['3'], paddingBottom: spacing['2'] }}>
        <Text style={textStyle('h1')}>Produtos</Text>

        <View
          style={{
            marginTop: spacing['3'],
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            borderWidth: 1,
            borderColor: colors.border.subtle,
            borderRadius: 999,
            paddingHorizontal: 14,
            paddingVertical: 12,
            backgroundColor: colors.background.surface,
          }}
        >
          <Ionicons name="search" size={18} color={colors.text.tertiary} />
          <TextInput
            ref={(r) => (inputRef.current = r)}
            value={query}
            onChangeText={setQuery}
            placeholder="O que vai pedir hoje?"
            placeholderTextColor={colors.text.tertiary}
            style={{ flex: 1, color: colors.text.primary, fontSize: 16 }}
            returnKeyType="search"
          />
          {query ? (
            <Pressable
              onPress={() => setQuery('')}
              style={{ padding: 6 }}
              hitSlop={10}
            >
              <Ionicons name="close-circle" size={18} color={colors.text.tertiary} />
            </Pressable>
          ) : null}
        </View>

        {/* Filters */}
        <View style={{ flexDirection: 'row', gap: spacing['2'], marginTop: spacing['3'] }}>
          {([
            { key: 'all', label: 'Todos' },
            { key: 'fresh', label: 'Frescos' },
            { key: 'frozen', label: 'Congelados' },
          ] as const).map((f) => (
            <Pressable
              key={f.key}
              onPress={() => setFreshFilter(f.key)}
              style={({ pressed }) => ({
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor:
                  f.key === freshFilter
                    ? colors.brand.primary
                    : pressed
                      ? colors.background.app
                      : colors.background.surface,
                borderWidth: 1,
                borderColor: f.key === freshFilter ? colors.brand.primary : colors.border.subtle,
              })}
            >
              <Text style={[textStyle('caption'), { color: f.key === freshFilter ? colors.text.inverse : colors.text.secondary }]}
              >
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={{ marginTop: spacing['3'] }}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={categories}
            keyExtractor={(c) => c}
            contentContainerStyle={{ gap: spacing['2'] }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => setCategory(item)}
                style={({ pressed }) => ({
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor:
                    item === category
                      ? colors.text.primary
                      : pressed
                        ? colors.background.app
                        : colors.background.surface,
                  borderWidth: 1,
                  borderColor: item === category ? colors.text.primary : colors.border.subtle,
                })}
              >
                <Text style={[textStyle('caption'), { color: item === category ? colors.text.inverse : colors.text.secondary }]}
                >
                  {item}
                </Text>
              </Pressable>
            )}
          />
        </View>

        {loading ? (
          <Text style={[textStyle('small'), { color: colors.text.secondary, marginTop: spacing['2'] }]}>Carregando...</Text>
        ) : null}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingHorizontal: spacing['4'], paddingBottom: 140, gap: spacing['3'] }}
        renderItem={({ item }) => (
          <ProductRow
            p={item}
            sellerName={sellersById[item.seller_id]?.display_name}
            onPress={() => navigation.navigate('Product', { productId: item.id })}
          />
        )}
        ListEmptyComponent={!loading ? (
          <View style={{ paddingHorizontal: spacing['4'], paddingVertical: spacing['5'] }}>
            <Text style={[textStyle('body'), { color: colors.text.secondary }]}>Nada por aqui 😕</Text>
            <Text style={[textStyle('caption'), { color: colors.text.tertiary, marginTop: spacing['1'] }]}>
              Ajuste filtros ou tente outra busca.
            </Text>
          </View>
        ) : null}
      />
    </SafeAreaView>
  );
}
