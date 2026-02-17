import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, SafeAreaView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { supabase } from '../supabaseClient';
import { useBuyer } from '../context/BuyerContext';
import Card from '../components/Card';
import Badge from '../components/Badge';
import { colors, spacing, textStyle } from '../theme';

type ProductRow = {
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

  sellers?: {
    display_name: string;
    active: boolean;
    b2c_enabled: boolean;
  } | null;
};

const CATEGORY_OPTIONS = ['Todos', 'Pescados', 'Frutos do mar', 'Iguarias'];

function centsToBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function ProductsScreen() {
  const navigation = useNavigation<any>();
  const { channel } = useBuyer();

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductRow[]>([]);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('Todos');
  const [freshFilter, setFreshFilter] = useState<'all' | 'fresh' | 'frozen'>('all');

  async function load() {
    setLoading(true);

    const { data, error } = await supabase
      .from('products')
      .select(
        'id, seller_id, name, category, fresh, active, base_price_cents, unit, pricing_mode, estimated_box_weight_kg, max_weight_variation_pct, sellers(display_name, active, b2c_enabled)'
      )
      .eq('active', true)
      .order('name', { ascending: true });

    if (!error) {
      const list = (data ?? []) as any as ProductRow[];

      // Filter by seller rules
      const filtered = list.filter((p) => {
        const s = (p as any).sellers;
        if (!s) return false;
        if (!s.active) return false;
        if (channel === 'b2c' && !s.b2c_enabled) return false;
        return true;
      });

      setProducts(filtered);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();

    const channelRealtime = supabase
      .channel('realtime-products-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sellers' }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(channelRealtime);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();

    return products
      .filter((p) => {
        if (category !== 'Todos') {
          const cat = (p.category ?? '').toLowerCase();
          if (!cat.includes(category.toLowerCase())) return false;
        }
        if (freshFilter === 'fresh' && !p.fresh) return false;
        if (freshFilter === 'frozen' && p.fresh) return false;
        if (q) {
          const hay = `${p.name} ${(p as any).sellers?.display_name ?? ''} ${(p.category ?? '')}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [products, query, category, freshFilter]);

  function priceLabel(p: ProductRow): string {
    if (p.pricing_mode === 'per_kg_box') {
      const est = p.estimated_box_weight_kg ? ` • ~${p.estimated_box_weight_kg}kg/cx` : '';
      return `${centsToBRL(p.base_price_cents)} / kg${est}`;
    }
    return `${centsToBRL(p.base_price_cents)} / ${p.unit}`;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.app }}>
      <View style={{ padding: spacing['4'], gap: spacing['3'] }}>
        <Text style={textStyle('h1')}>Produtos</Text>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar produto, fornecedor..."
          placeholderTextColor={colors.text.tertiary}
          style={{
            borderWidth: 1,
            borderColor: colors.border.default,
            borderRadius: 14,
            paddingHorizontal: 14,
            paddingVertical: 12,
            backgroundColor: colors.background.surface,
            color: colors.text.primary,
          }}
        />

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing['2'] }}>
          {CATEGORY_OPTIONS.map((c) => (
            <TouchableOpacity key={c} onPress={() => setCategory(c)}>
              <Badge label={c} variant={category === c ? 'variable' : 'neutral'} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: spacing['2'], flexWrap: 'wrap' }}>
          <TouchableOpacity onPress={() => setFreshFilter('all')}>
            <Badge label="Todos" variant={freshFilter === 'all' ? 'variable' : 'neutral'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setFreshFilter('fresh')}>
            <Badge label="Frescos" variant={freshFilter === 'fresh' ? 'fresh' : 'neutral'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setFreshFilter('frozen')}>
            <Badge label="Congelados" variant={freshFilter === 'frozen' ? 'frozen' : 'neutral'} />
          </TouchableOpacity>
        </View>

        {loading ? <Text style={[textStyle('small'), { color: colors.text.secondary }]}>Carregando...</Text> : null}
      </View>

      <FlatList
        data={filteredProducts}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: spacing['4'], gap: spacing['3'], paddingBottom: 120 }}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => navigation.navigate('Product', { productId: item.id })}>
            <Card>
              <Text style={textStyle('h3')}>{item.name}</Text>
              <Text style={[textStyle('caption'), { color: colors.text.secondary, marginTop: spacing['1'] }]}
              >
                {(item as any).sellers?.display_name ?? '—'}
              </Text>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing['2'], marginTop: spacing['2'] }}>
                <Badge label={item.fresh ? 'Fresco' : 'Congelado'} variant={item.fresh ? 'fresh' : 'frozen'} />
                {item.pricing_mode === 'per_kg_box' ? <Badge label="Peso variável" variant="variable" /> : null}
                {item.category ? <Badge label={item.category} variant="neutral" /> : null}
              </View>

              <Text style={[textStyle('bodyStrong'), { marginTop: spacing['2'] }]}>{priceLabel(item)}</Text>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={!loading ? (
          <Text style={{ padding: spacing['4'], color: colors.text.secondary }}>Nenhum produto disponível.</Text>
        ) : null}
      />
    </SafeAreaView>
  );
}
