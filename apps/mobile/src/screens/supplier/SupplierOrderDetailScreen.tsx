import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../../supabaseClient';
import { updateOrderWeights, confirmManualPayment } from '../../api';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Input from '../../components/Input';
import { useSeller } from '../../context/SellerContext';
import { colors, spacing, textStyle } from '../../theme';
import { centsToBRL } from '../../utils';

type OrderItem = {
  id: string;
  product_name_snapshot: string;
  variant_name_snapshot: string | null;
  unit_snapshot: string;
  pricing_mode_snapshot: string;
  unit_price_cents_snapshot: number;
  quantity: number;
  estimated_total_weight_kg_snapshot: number | null;
  actual_total_weight_kg: number | null;
  line_total_cents_snapshot: number;
};

export default function SupplierOrderDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const orderId = route.params?.orderId;
  const { sellerId } = useSeller();

  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    const query = supabase.from('orders').select('*').eq('id', orderId);
    if (sellerId) query.eq('seller_id', sellerId);
    const { data: o } = await query.single();
    setOrder(o);
    const { data: its } = await supabase.from('order_items').select('*').eq('order_id', orderId);
    setItems(its ?? []);

    // Init weight inputs
    const w: Record<string, string> = {};
    (its ?? []).forEach((it: OrderItem) => {
      if (it.pricing_mode_snapshot === 'per_kg_box') {
        w[it.id] = it.actual_total_weight_kg?.toString() ?? '';
      }
    });
    setWeights(w);
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  const hasVariableItems = items.some(it => it.pricing_mode_snapshot === 'per_kg_box');

  async function handleSaveWeights() {
    const weightItems = items
      .filter(it => it.pricing_mode_snapshot === 'per_kg_box' && weights[it.id])
      .map(it => ({
        orderItemId: it.id,
        actualTotalWeightKg: parseFloat(weights[it.id].replace(',', '.')),
      }));

    if (!weightItems.length) {
      Alert.alert('Nenhum peso', 'Preencha pelo menos um peso real.');
      return;
    }

    setSaving(true);
    try {
      const res = await updateOrderWeights(orderId, weightItems);
      Alert.alert('Pesos salvos', `Ajuste: ${res.delta}`);
      load();
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Falha ao salvar pesos');
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmPayment() {
    Alert.alert(
      'Confirmar pagamento',
      'Você confirma que recebeu o PIX deste pedido? O cliente será notificado e o pedido será marcado como pago.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar', style: 'default',
          onPress: async () => {
            setConfirming(true);
            try {
              await confirmManualPayment(orderId);
              Alert.alert('Confirmado', 'Pagamento confirmado e e-mail enviado ao cliente.');
              load();
            } catch (e: any) {
              Alert.alert('Erro', e?.message ?? 'Falha ao confirmar pagamento');
            } finally {
              setConfirming(false);
            }
          },
        },
      ]
    );
  }

  const isAwaitingPixConfirmation = order?.payment_method === 'pix' && order?.status === 'pending_payment';

  if (!order) return (
    <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background.app }}>
      <ActivityIndicator size="large" color={colors.brand.primary} />
    </SafeAreaView>
  );

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('pt-BR'); } catch { return iso; }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.app }}>
      <ScrollView contentContainerStyle={{ padding: spacing['4'], gap: spacing['4'] }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={textStyle('h2')}>Pedido #{orderId.slice(0, 8)}</Text>
          <Button title="Voltar" variant="ghost" size="sm" onPress={() => navigation.goBack()} />
        </View>

        {/* Order info */}
        <Card>
          <View style={{ gap: spacing['2'] }}>
            <View style={{ flexDirection: 'row', gap: spacing['2'] }}>
              <Badge label={order.buyer_channel?.toUpperCase()} variant={order.buyer_channel === 'b2b' ? 'b2b' : 'b2c'} />
              <Badge label={order.status} variant={order.status === 'paid' ? 'fresh' : 'neutral'} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[textStyle('caption'), { color: colors.text.secondary }]}>Criado: {formatDate(order.created_at)}</Text>
              <Text style={[textStyle('caption'), { color: colors.text.secondary }]}>Entrega: {order.delivery_date ? formatDate(order.delivery_date) : '-'}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing['2'] }}>
              <Text style={textStyle('body')}>Subtotal</Text>
              <Text style={textStyle('body')}>{centsToBRL(order.subtotal_cents)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={textStyle('body')}>Frete</Text>
              <Text style={textStyle('body')}>{centsToBRL(order.shipping_cents)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={textStyle('bodyStrong')}>Total</Text>
              <Text style={[textStyle('bodyStrong'), { color: colors.brand.primary }]}>{centsToBRL(order.total_cents)}</Text>
            </View>
            {order.delivery_notes ? (
              <Text style={[textStyle('caption'), { color: colors.text.secondary, marginTop: spacing['2'] }]}>
                Obs: {order.delivery_notes}
              </Text>
            ) : null}
          </View>
        </Card>

        {/* Confirm PIX payment button */}
        {isAwaitingPixConfirmation && (
          <Card style={{ backgroundColor: '#FFF8E1', borderColor: '#FFD54F', borderWidth: 1 }}>
            <View style={{ gap: spacing['2'] }}>
              <Text style={[textStyle('bodyStrong'), { color: '#F57F17' }]}>⏳ Aguardando confirmação de PIX</Text>
              <Text style={[textStyle('caption'), { color: colors.text.secondary }]}>
                Verifique se o PIX foi recebido na conta da plataforma e confirme abaixo.
              </Text>
              <Button
                title={confirming ? 'Confirmando...' : '✅ Confirmar recebimento do PIX'}
                onPress={handleConfirmPayment}
                disabled={confirming}
              />
            </View>
          </Card>
        )}

        {/* Items */}
        <Card>
          <Text style={[textStyle('bodyStrong'), { marginBottom: spacing['3'] }]}>Itens</Text>
          {items.map(it => (
            <View key={it.id} style={{ paddingVertical: spacing['2'], borderBottomWidth: 1, borderBottomColor: colors.border.subtle, gap: spacing['1'] }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={textStyle('body')} numberOfLines={1}>{it.product_name_snapshot}</Text>
                <Text style={textStyle('bodyStrong')}>{centsToBRL(it.line_total_cents_snapshot)}</Text>
              </View>
              {it.variant_name_snapshot && (
                <Text style={[textStyle('caption'), { color: colors.text.secondary }]}>Variante: {it.variant_name_snapshot}</Text>
              )}
              <Text style={[textStyle('caption'), { color: colors.text.secondary }]}>
                {it.quantity} {it.unit_snapshot} x {centsToBRL(it.unit_price_cents_snapshot)}/{it.unit_snapshot}
              </Text>

              {it.pricing_mode_snapshot === 'per_kg_box' && (
                <View style={{ marginTop: spacing['2'], gap: spacing['1'] }}>
                  <Text style={[textStyle('caption'), { color: colors.text.secondary }]}>
                    Peso estimado: {it.estimated_total_weight_kg_snapshot?.toFixed(1) ?? '-'} kg
                  </Text>
                  <Input
                    label="Peso real (kg)"
                    value={weights[it.id] ?? ''}
                    onChangeText={v => setWeights(prev => ({ ...prev, [it.id]: v }))}
                    placeholder="0.0"
                    keyboardType="decimal-pad"
                  />
                </View>
              )}
            </View>
          ))}
        </Card>

        {hasVariableItems && order.status === 'paid' && (
          <Button title={saving ? 'Salvando...' : 'Salvar pesos reais'} onPress={handleSaveWeights} disabled={saving} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
