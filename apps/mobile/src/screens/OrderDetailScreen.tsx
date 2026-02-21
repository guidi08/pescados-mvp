import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, SafeAreaView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

import { supabase } from '../supabaseClient';
import { cancelOrder } from '../api';
import { useCart } from '../context/CartContext';
import Card from '../components/Card';
import Badge from '../components/Badge';
import { colors, spacing, textStyle } from '../theme';

type OrderItem = {
  id: string;
  product_id: string;
  variant_id: string | null;
  product_name_snapshot: string;
  variant_name_snapshot: string | null;
  unit_snapshot: string;
  pricing_mode_snapshot: 'per_unit' | 'per_kg_box';
  unit_price_cents_snapshot: number;
  quantity: number;
  estimated_total_weight_kg_snapshot: number | null;
  line_total_cents_snapshot: number;
};

type Order = {
  id: string;
  created_at: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  subtotal_cents: number;
  shipping_cents: number;
  total_cents: number;
  contains_fresh: boolean;
  delivery_date: string | null;
  delivery_notes: string | null;
  seller_id: string;
  sellers?: { display_name: string } | null;
  order_items?: OrderItem[];
};

function centsToBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function statusLabel(o: Order): { label: string; variant: any } {
  if (o.status === 'canceled') return { label: 'Cancelado', variant: 'neutral' };
  if (o.payment_status === 'processing') return { label: 'Processando pagamento', variant: 'neutral' };
  if (o.payment_status === 'failed') return { label: 'Pagamento falhou', variant: 'variable' };
  if (o.payment_status === 'unpaid' || o.status === 'pending_payment') return { label: 'Pagamento não confirmado', variant: 'variable' };
  if (o.status === 'paid') return { label: 'Pago', variant: 'fresh' };
  if (o.status === 'fulfilled') return { label: 'Concluído', variant: 'fresh' };
  return { label: o.status, variant: 'neutral' };
}

export default function OrderDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const orderId = route.params?.orderId as string;

  const { addItem, clear } = useCart();

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<Order | null>(null);

  async function load() {
    setLoading(true);

    const { data } = await supabase
      .from('orders')
      .select(
        [
          'id,created_at,status,payment_status,payment_method,subtotal_cents,shipping_cents,total_cents,contains_fresh,delivery_date,delivery_notes,seller_id',
          'sellers(display_name)',
          'order_items(id,product_id,variant_id,product_name_snapshot,variant_name_snapshot,unit_snapshot,pricing_mode_snapshot,unit_price_cents_snapshot,quantity,estimated_total_weight_kg_snapshot,line_total_cents_snapshot)',
        ].join(',')
      )
      .eq('id', orderId)
      .single();

    setOrder(data as any);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [orderId]);

  const status = order ? statusLabel(order) : null;

  const sellerName = order?.sellers?.display_name ?? 'Fornecedor';

  const canAttemptCancel = useMemo(() => {
    if (!order) return false;
    if (order.status === 'canceled') return false;
    if (order.contains_fresh) return false;
    // Backend enforces the true rule. Here we just surface the button for frozen items.
    return true;
  }, [order]);

  function reorder() {
    if (!order) return;

    clear();
    for (const it of order.order_items ?? []) {
      const estimatedBoxWeightKg =
        it.pricing_mode_snapshot === 'per_kg_box' && it.estimated_total_weight_kg_snapshot && it.quantity
          ? Number(it.estimated_total_weight_kg_snapshot) / Number(it.quantity)
          : null;

      addItem(order.seller_id, sellerName, {
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

  async function attemptCancel() {
    if (!order) return;

    Alert.alert(
      'Cancelar pedido',
      'Tem certeza? Para itens congelados, o cancelamento é permitido até 6 horas antes do cut-off do fornecedor (regra validada automaticamente).',
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Cancelar pedido',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelOrder(order.id);
              Alert.alert('Pedido cancelado', 'Seu pedido foi cancelado.');
              await load();
            } catch (e: any) {
              Alert.alert('Não foi possível cancelar', e?.message ?? 'Tente novamente.');
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.app }}>
      <View style={{ padding: spacing['4'], paddingBottom: spacing['3'] }}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginBottom: spacing['3'],
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons name="chevron-back" size={22} color={colors.brand.primary} />
          <Text style={[textStyle('bodyStrong'), { color: colors.brand.primary }]}>Voltar</Text>
        </Pressable>

        <Text style={textStyle('h1')}>Detalhes do pedido</Text>
        {loading ? <Text style={[textStyle('small'), { color: colors.text.secondary, marginTop: spacing['2'] }]}>Carregando...</Text> : null}
      </View>

      {order ? (
        <FlatList
          data={order.order_items ?? []}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ paddingHorizontal: spacing['4'], paddingBottom: 24, gap: spacing['3'] }}
          ListHeaderComponent={
            <View style={{ gap: spacing['3'] }}>
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={textStyle('h3')}>{sellerName}</Text>
                    <Text style={[textStyle('caption'), { color: colors.text.secondary, marginTop: 2 }]}
                    >
                      Pedido #{String(order.id).slice(0, 8)} • {new Date(order.created_at).toLocaleString('pt-BR')}
                    </Text>
                  </View>
                  {status ? <Badge label={status.label} variant={status.variant} /> : null}
                </View>

                <View style={{ marginTop: spacing['3'], gap: spacing['2'] }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={[textStyle('caption'), { color: colors.text.secondary }]}>Pagamento</Text>
                    <Text style={[textStyle('caption'), { color: colors.text.primary }]}
                    >
                      {order.payment_method ? order.payment_method.toUpperCase() : '—'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={[textStyle('caption'), { color: colors.text.secondary }]}>Entrega</Text>
                    <Text style={[textStyle('caption'), { color: colors.text.primary }]}
                    >
                      {order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('pt-BR') : 'A definir'}
                    </Text>
                  </View>
                  {order.delivery_notes ? (
                    <View>
                      <Text style={[textStyle('caption'), { color: colors.text.secondary }]}>Observações</Text>
                      <Text style={[textStyle('body'), { color: colors.text.primary, marginTop: 2 }]}>
                        {order.delivery_notes}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </Card>

              <Text style={textStyle('h2')}>Itens</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Card>
              <Text style={textStyle('bodyStrong')}>
                {item.product_name_snapshot}
                {item.variant_name_snapshot ? ` • ${item.variant_name_snapshot}` : ''}
              </Text>
              <Text style={[textStyle('caption'), { color: colors.text.secondary, marginTop: 4 }]}
              >
                {item.pricing_mode_snapshot === 'per_kg_box'
                  ? `${centsToBRL(item.unit_price_cents_snapshot)}/kg`
                  : `${centsToBRL(item.unit_price_cents_snapshot)}/${item.unit_snapshot}`}
              </Text>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing['3'] }}>
                <Text style={[textStyle('caption'), { color: colors.text.secondary }]}>Qtd.</Text>
                <Text style={textStyle('caption')}>{String(item.quantity)}</Text>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                <Text style={[textStyle('caption'), { color: colors.text.secondary }]}>Total</Text>
                <Text style={textStyle('bodyStrong')}>{centsToBRL(item.line_total_cents_snapshot)}</Text>
              </View>
            </Card>
          )}
          ListFooterComponent={
            <View style={{ gap: spacing['3'], marginTop: spacing['3'] }}>
              <Card>
                <Text style={textStyle('h2')}>Resumo</Text>
                <View style={{ marginTop: spacing['3'], gap: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={[textStyle('body'), { color: colors.text.secondary }]}>Subtotal</Text>
                    <Text style={textStyle('bodyStrong')}>{centsToBRL(order.subtotal_cents)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={[textStyle('body'), { color: colors.text.secondary }]}>Frete</Text>
                    <Text style={textStyle('bodyStrong')}>{centsToBRL(order.shipping_cents)}</Text>
                  </View>
                  <View style={{ height: 1, backgroundColor: colors.border.subtle }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={textStyle('bodyStrong')}>Total</Text>
                    <Text style={textStyle('h2')}>{centsToBRL(order.total_cents)}</Text>
                  </View>
                </View>
              </Card>

              <View style={{ flexDirection: 'row', gap: spacing['3'] }}>
                <Pressable
                  onPress={reorder}
                  style={({ pressed }) => ({
                    flex: 1,
                    paddingVertical: 14,
                    borderRadius: 14,
                    backgroundColor: pressed ? colors.brand.primaryDark : colors.brand.primary,
                    alignItems: 'center',
                  })}
                >
                  <Text style={[textStyle('bodyStrong'), { color: colors.text.inverse }]}>Repetir pedido</Text>
                </Pressable>

                {canAttemptCancel ? (
                  <Pressable
                    onPress={attemptCancel}
                    style={({ pressed }) => ({
                      flex: 1,
                      paddingVertical: 14,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: colors.border.default,
                      alignItems: 'center',
                      backgroundColor: pressed ? colors.background.surface : 'transparent',
                    })}
                  >
                    <Text style={[textStyle('bodyStrong'), { color: colors.text.primary }]}>Cancelar</Text>
                  </Pressable>
                ) : null}
              </View>

              {order.contains_fresh ? (
                <Text style={[textStyle('caption'), { color: colors.text.tertiary, textAlign: 'center' }]}
                >
                  Este pedido contém itens frescos — cancelamento indisponível.
                </Text>
              ) : null}
            </View>
          }
        />
      ) : (
        !loading && (
          <View style={{ padding: spacing['5'] }}>
            <Text style={textStyle('body')}>Pedido não encontrado.</Text>
          </View>
        )
      )}
    </SafeAreaView>
  );
}
