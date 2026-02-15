import React, { useEffect, useState } from 'react';
import { Alert, FlatList, SafeAreaView, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../supabaseClient';
import Button from '../components/Button';
import Card from '../components/Card';
import { colors, spacing, textStyle } from '../theme';

type Order = {
  id: string;
  status: string;
  payment_status: string;
  total_cents: number;
  delivery_date: string | null;
  created_at: string;
};

function centsToBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function OrdersScreen({ navigation }: any) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) return;

    const { data, error } = await supabase
      .from('orders')
      .select('id,status,payment_status,total_cents,delivery_date,created_at')
      .eq('buyer_id', userId)
      .order('created_at', { ascending: false });

    if (!error) setOrders((data ?? []) as any);
    setLoading(false);
  }

  useEffect(() => {
    load();

    const channel = supabase
      .channel('realtime-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function showDetails(orderId: string) {
    const { data: items } = await supabase
      .from('order_items')
      .select('product_name_snapshot, variant_name_snapshot, quantity, unit_snapshot, unit_price_cents_snapshot, pricing_mode_snapshot, estimated_total_weight_kg_snapshot, line_total_cents_snapshot')
      .eq('order_id', orderId);

    const lines = (items ?? []).map((i: any) => {
      const name = `${i.product_name_snapshot}${i.variant_name_snapshot ? ` (${i.variant_name_snapshot})` : ''}`;

      if (i.pricing_mode_snapshot === 'per_kg_box') {
        const boxes = i.quantity;
        const estW = i.estimated_total_weight_kg_snapshot ?? '—';
        const priceKg = centsToBRL(i.unit_price_cents_snapshot);
        const total = centsToBRL(i.line_total_cents_snapshot);
        return `• ${name} — ${boxes} cx • ~${estW} kg • ${priceKg}/kg • Total est.: ${total}`;
      }

      const qty = `${i.quantity} ${i.unit_snapshot}`;
      const price = centsToBRL(i.unit_price_cents_snapshot);
      const total = centsToBRL(i.line_total_cents_snapshot);
      return `• ${name} — ${qty} — ${price}/${i.unit_snapshot} • Total: ${total}`;
    }).join('\n');

    Alert.alert('Itens do pedido', lines || 'Sem itens');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.app }}>
      <View style={{ padding: spacing['4'], gap: spacing['3'] }}>
        <Text style={textStyle('h1')}>Meus pedidos</Text>
        <Button title="Voltar" onPress={() => navigation.goBack()} size="sm" variant="secondary" />
        {loading ? <Text style={[textStyle('small'), { color: colors.text.secondary }]}>Carregando...</Text> : null}
      </View>

      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: spacing['4'], gap: spacing['3'] }}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => showDetails(item.id)}>
            <Card>
              <Text style={textStyle('h3')}>Pedido {item.id.slice(0, 8)}...</Text>
              <Text style={[textStyle('small'), { color: colors.text.secondary, marginTop: spacing['2'] }]}
              >
                Status: {item.status} • Pagamento: {item.payment_status}
              </Text>
              <Text style={[textStyle('bodyStrong'), { marginTop: spacing['2'] }]}>{centsToBRL(item.total_cents)}</Text>
              {item.delivery_date ? (
                <Text style={[textStyle('small'), { color: colors.text.secondary }]}
                >Entrega: {item.delivery_date}</Text>
              ) : null}
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={!loading ? (
          <Text style={{ padding: spacing['4'], color: colors.text.secondary }}>Nenhum pedido ainda.</Text>
        ) : null}
      />
    </SafeAreaView>
  );
}
