import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, SafeAreaView, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../App';
import { supabase } from '../supabaseClient';
import { useCart } from '../context/CartContext';
import Card from '../components/Card';
import Badge from '../components/Badge';
import { colors, spacing, textStyle } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Seller'>;

type Product = {
  id: string;
  name: string;
  fresh: boolean;
  min_expiry_date: string | null;
  active: boolean;
  base_price_cents: number;
  unit: string;

  pricing_mode: 'per_unit' | 'per_kg_box';
  estimated_box_weight_kg: number | null;
  max_weight_variation_pct: number | null;
};

function centsToBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function SellerScreen({ route, navigation }: Props) {
  const { sellerId, sellerName } = route.params;
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { sellerId: cartSellerId } = useCart();

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('id, name, fresh, min_expiry_date, active, base_price_cents, unit, pricing_mode, estimated_box_weight_kg, max_weight_variation_pct')
      .eq('seller_id', sellerId)
      .order('name', { ascending: true });

    if (!error) {
      const list = (data ?? []) as any as Product[];
      // active first
      list.sort((a, b) => Number(b.active) - Number(a.active));
      setProducts(list);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel('realtime-products-mobile')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products', filter: `seller_id=eq.${sellerId}` }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerId]);

  const warningDifferentSeller = useMemo(() => {
    return cartSellerId && cartSellerId !== sellerId;
  }, [cartSellerId, sellerId]);

  function priceLabel(p: Product): string {
    if (p.pricing_mode === 'per_kg_box') {
      const est = p.estimated_box_weight_kg ? ` • ~${p.estimated_box_weight_kg}kg/cx` : '';
      return `${centsToBRL(p.base_price_cents)} / kg${est}`;
    }
    return `${centsToBRL(p.base_price_cents)} / ${p.unit}`;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.app }}>
      <View style={{ padding: spacing['4'], gap: spacing['2'] }}>
        <Text style={textStyle('h1')}>{sellerName}</Text>

        {warningDifferentSeller ? (
          <Text style={[textStyle('small'), { color: colors.semantic.warning }]}
          >
            Atenção: seu carrinho contém itens de outro fornecedor. Ao adicionar aqui, o carrinho será substituído.
          </Text>
        ) : null}

        {loading ? <Text style={[textStyle('small'), { color: colors.text.secondary }]}>Carregando...</Text> : null}
      </View>

      <FlatList
        data={products}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: spacing['4'], gap: spacing['3'], paddingBottom: 120 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            disabled={!item.active}
            onPress={() => navigation.navigate('Product', { productId: item.id })}
            style={{ opacity: item.active ? 1 : 0.5 }}
          >
            <Card>
              <Text style={textStyle('h3')}>{item.name}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing['2'], marginTop: spacing['2'] }}>
                <Badge label={item.fresh ? 'Fresco' : 'Congelado'} variant={item.fresh ? 'fresh' : 'frozen'} />
                {item.pricing_mode === 'per_kg_box' ? <Badge label="Peso variável" variant="variable" /> : null}
              </View>
              <Text style={[textStyle('small'), { color: colors.text.secondary, marginTop: spacing['2'] }]}
              >
                {item.min_expiry_date ? `Validade mínima: ${item.min_expiry_date}` : 'Validade: —'}
              </Text>
              <Text style={[textStyle('bodyStrong'), { marginTop: spacing['2'] }]}>{priceLabel(item)}</Text>
              {!item.active ? (
                <Text style={[textStyle('caption'), { color: colors.text.tertiary, marginTop: spacing['2'] }]}>Pausado</Text>
              ) : null}
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={!loading ? (
          <Text style={{ padding: spacing['4'], color: colors.text.secondary }}>Nenhum produto.</Text>
        ) : null}
      />
    </SafeAreaView>
  );
}
