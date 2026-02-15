import React, { useEffect, useState } from 'react';
import { Alert, Button, FlatList, SafeAreaView, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../supabaseClient';

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
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ padding: 16, gap: 10 }}>
        <Text style={{ fontSize: 22, fontWeight: '800' }}>Meus pedidos</Text>
        <Button title="Voltar" onPress={() => navigation.goBack()} />
        {loading ? <Text>Carregando...</Text> : null}
      </View>

      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => showDetails(item.id)}
            style={{ backgroundColor: 'white', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#eee' }}
          >
            <Text style={{ fontWeight: '800' }}>Pedido {item.id.slice(0, 8)}...</Text>
            <Text style={{ color: '#666', marginTop: 4 }}>
              Status: {item.status} • Pagamento: {item.payment_status}
            </Text>
            <Text style={{ marginTop: 6, fontSize: 16 }}>{centsToBRL(item.total_cents)}</Text>
            {item.delivery_date ? <Text style={{ color: '#666' }}>Entrega: {item.delivery_date}</Text> : null}
          </TouchableOpacity>
        )}
        ListEmptyComponent={!loading ? <Text style={{ padding: 16, color: '#666' }}>Nenhum pedido ainda.</Text> : null}
      />
    </SafeAreaView>
  );
}
