import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, SafeAreaView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { supabase } from '../supabaseClient';
import { useCart } from '../context/CartContext';
import Card from '../components/Card';
import Badge from '../components/Badge';
import { colors, spacing, textStyle } from '../theme';

type OrderItem = {
  product_id: string;
  variant_id: string | null;
  product_name_snapshot: string;
  variant_name_snapshot: string | null;
  unit_snapshot: string;
  pricing_mode_snapshot: 'per_unit' | 'per_kg_box';
  unit_price_cents_snapshot: number;
  quantity: number;
  estimated_total_weight_kg_snapshot: number | null;
};

type OrderRow = {
  id: string;
  created_at: string;
  status: string;
  payment_status: string;
  total_cents: number;
  contains_fresh: boolean;
  seller_id: string;
  sellers?: { display_name: string } | null;
  order_items?: OrderItem[];
};

function centsToBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function statusLabel(o: OrderRow): { label: string; variant: any } {
  if (o.status === 'canceled') return { label: 'Cancelado', variant: 'neutral' };
  if (o.payment_status === 'processing') return { label: 'Processando pagamento', variant: 'neutral' };
  if (o.payment_status === 'failed') return { label: 'Pagamento falhou', variant: 'variable' };
  if (o.payment_status === 'unpaid' || o.status === 'pending_payment') return { label: 'Pagamento não confirmado', variant: 'variable' };
  if (o.status === 'paid') return { label: 'Pago', variant: 'fresh' };
  if (o.status === 'fulfilled') return { label: 'Concluído', variant: 'fresh' };
  return { label: o.status, variant: 'neutral' };
}

export default function OrdersScreen() {
  const navigation = useNavigation<any>();
  const { addItem, clear } = useCart();

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderRow[]>([]);

  async function load() {
    setLoading(true);

    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session?.user;
    if (!user) {
      setOrders([]);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('orders')
      .select(
        [
          'id,created_at,status,payment_status,total_cents,contains_fresh,seller_id',
          'sellers(display_name)',
          'order_items(product_id,variant_id,product_name_snapshot,variant_name_snapshot,unit_snapshot,pricing_mode_snapshot,unit_price_cents_snapshot,quantity,estimated_total_weight_kg_snapshot)',
        ].join(',')
      )
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    setOrders((data ?? []) as any);
    setLoading(false);
  }

  useEffect(() => {
    load();

    const realtime = supabase
      .channel('realtime-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(realtime);
    };
  }, []);

  const grouped = useMemo(() => {
    // simple grouping by date string
    const groups: Array<{ type: 'header' | 'order'; key: string; date?: string; order?: OrderRow }> = [];
    let lastDate = '';

    for (const o of orders) {
      const date = fmtDate(new Date(o.created_at));
      if (date !== lastDate) {
        groups.push({ type: 'header', key: `h:${date}`, date });
        lastDate = date;
      }
      groups.push({ type: 'order', key: `o:${o.id}`, order: o });
    }

    return groups;
  }, [orders]);

  function reorder(o: OrderRow) {
    const sellerName = o.sellers?.display_name ?? 'Fornecedor';

    // iFood-style: 1 seller per cart → limpar e adicionar
    clear();

    for (const it of o.order_items ?? []) {
      // Recover an estimated "box weight" from total snapshot when pricing_mode is per_kg_box
      const estimatedBoxWeightKg =
        it.pricing_mode_snapshot === 'per_kg_box' && it.estimated_total_weight_kg_snapshot && it.quantity
          ? Number(it.estimated_total_weight_kg_snapshot) / Number(it.quantity)
          : null;

      addItem(o.seller_id, sellerName, {
        productId: it.product_id,
        variantId: it.variant_id,
        productName: it.product_name_snapshot,
        variantName: it.variant_name_snapshot,
        unit: it.unit_snapshot,
        pricingMode: it.pricing_mode_snapshot,
        unitPriceCents: it.unit_price_cents_snapshot,
        quantity: Number(it.quantity ?? 1),
        estimatedBoxWeightKg,
        maxWeightVariationPct: 10,
      });
    }

    navigation.navigate('Cart');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.app }}>
      <View style={{ paddingHorizontal: spacing['4'], paddingTop: spacing['3'], paddingBottom: spacing['2'] }}>
        <Text style={textStyle('h1')}>Histórico</Text>
        <Text style={[textStyle('caption'), { color: colors.text.secondary, marginTop: 6 }]}
        >
          Seus pedidos mais recentes
        </Text>
        {loading ? <Text style={[textStyle('small'), { color: colors.text.secondary, marginTop: spacing['2'] }]}>Carregando...</Text> : null}
      </View>

      <FlatList
        data={grouped}
        keyExtractor={(i) => i.key}
        contentContainerStyle={{ paddingHorizontal: spacing['4'], paddingBottom: 24 }}
        renderItem={({ item }) => {
          if (item.type === 'header') {
            return (
              <View style={{ paddingTop: spacing['3'], paddingBottom: spacing['2'] }}>
                <Text style={[textStyle('label'), { color: colors.text.secondary }]}>{item.date}</Text>
              </View>
            );
          }

          const o = item.order as OrderRow;
          const sellerName = o.sellers?.display_name ?? 'Fornecedor';
          const first = (o.order_items ?? [])[0];
          const status = statusLabel(o);

          return (
            <View style={{ paddingBottom: spacing['3'] }}>
              <Card style={{ padding: spacing['3'] }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing['3'] }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: colors.background.surface,
                      borderWidth: 1,
                      borderColor: colors.border.subtle,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="storefront" size={20} color={colors.text.primary} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={textStyle('h3')}>{sellerName}</Text>
                      <Badge label={status.label} variant={status.variant} />
                    </View>

                    <Text style={[textStyle('caption'), { color: colors.text.secondary, marginTop: 4 }]}
                    >
                      {first ? `${first.product_name_snapshot}${first.variant_name_snapshot ? ` • ${first.variant_name_snapshot}` : ''}` : '—'}
                    </Text>

                    <Text style={[textStyle('caption'), { color: colors.text.tertiary, marginTop: 4 }]}
                    >
                      Total: {centsToBRL(o.total_cents)}
                      {o.contains_fresh ? ' • contém fresco' : ''}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: spacing['3'], marginTop: spacing['3'] }}>
                  <Pressable
                    onPress={() => navigation.navigate('OrderDetail', { orderId: o.id })}
                    style={({ pressed }) => ({
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: colors.brand.primary,
                      alignItems: 'center',
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <Text style={[textStyle('bodyStrong'), { color: colors.brand.primary }]}>Ver detalhes</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => reorder(o)}
                    style={({ pressed }) => ({
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 14,
                      backgroundColor: pressed ? colors.brand.primaryDark : colors.brand.primary,
                      alignItems: 'center',
                    })}
                  >
                    <Text style={[textStyle('bodyStrong'), { color: colors.text.inverse }]}>Adicionar à sacola</Text>
                  </Pressable>
                </View>
              </Card>
            </View>
          );
        }}
        ListEmptyComponent={!loading ? (
          <View style={{ paddingVertical: spacing['5'] }}>
            <Text style={textStyle('h2')}>Sem pedidos ainda</Text>
            <Text style={[textStyle('body'), { color: colors.text.secondary, marginTop: spacing['2'] }]}>
              Quando você fizer um pedido, ele aparece aqui.
            </Text>
          </View>
        ) : null}
      />
    </SafeAreaView>
  );
}
