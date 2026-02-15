import React, { useEffect, useState } from 'react';
import { Button, FlatList, SafeAreaView, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { supabase } from '../supabaseClient';
import { useCart } from '../context/CartContext';

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
  const { items, sellerId: cartSellerId } = useCart();

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('id, name, fresh, min_expiry_date, active, base_price_cents, unit, pricing_mode, estimated_box_weight_kg, max_weight_variation_pct')
      .eq('seller_id', sellerId)
      .order('name', { ascending: true });

    if (!error) {
      const list = (data ?? []) as any as Product[];
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
  }, [sellerId]);

  function priceLabel(p: Product): string {
    if (p.pricing_mode === 'per_kg_box') {
      const est = p.estimated_box_weight_kg ? ` • ~${p.estimated_box_weight_kg}kg/cx` : '';
      return `${centsToBRL(p.base_price_cents)} / kg${est}`;
    }
    return `${centsToBRL(p.base_price_cents)} / ${p.unit}`;
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ padding: 16, gap: 10 }}>
        <Text style={{ fontSize: 22, fontWeight: '700' }}>{sellerName}</Text>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title={`Carrinho (${items.length})`} onPress={() => navigation.navigate('Cart')} />
          <Button title="Voltar" onPress={() => navigation.goBack()} />
        </View>

        {cartSellerId && cartSellerId !== sellerId ? (
          <Text style={{ color: '#b45309' }}>
            Atenção: seu carrinho contém itens de outro fornecedor. Ao adicionar aqui, o carrinho será substituído.
          </Text>
        ) : null}

        {loading ? <Text>Carregando...</Text> : null}
      </View>

      <FlatList
        data={products}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            disabled={!item.active}
            onPress={() => navigation.navigate('Product', { productId: item.id })}
            style={{
              backgroundColor: 'white',
              padding: 14,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#eee',
              opacity: item.active ? 1 : 0.5,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700' }}>{item.name}</Text>
            <Text style={{ color: '#666', marginTop: 4 }}>
              {item.fresh ? 'Fresco' : 'Congelado'}
              {item.min_expiry_date ? ` • Validade mínima: ${item.min_expiry_date}` : ''}
              {item.pricing_mode === 'per_kg_box' ? ' • Por caixa (peso variável)' : ''}
            </Text>
            <Text style={{ marginTop: 6, fontSize: 16 }}>{priceLabel(item)}</Text>
            {!item.active ? <Text style={{ color: '#666', marginTop: 6 }}>Pausado</Text> : null}
          </TouchableOpacity>
        )}
        ListEmptyComponent={!loading ? <Text style={{ padding: 16, color: '#666' }}>Nenhum produto.</Text> : null}
      />
    </SafeAreaView>
  );
}
