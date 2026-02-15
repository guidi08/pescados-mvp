import React, { useEffect, useState } from 'react';
import { Alert, Button, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';
import { useCart } from '../context/CartContext';
import { createOrder, createPaymentSheet, createPixPayment } from '../api';
import { supabase } from '../supabaseClient';

function centsToBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

type Seller = {
  id: string;
  shipping_fee_cents: number;
  min_order_cents: number;
  cutoff_time: string;
};

export default function CheckoutScreen({ navigation }: any) {
  const { items, sellerId, clear, subtotalCents } = useCart();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const [seller, setSeller] = useState<Seller | null>(null);

  useEffect(() => {
    async function loadSeller() {
      if (!sellerId) return;
      const { data } = await supabase
        .from('sellers')
        .select('id, shipping_fee_cents, min_order_cents, cutoff_time')
        .eq('id', sellerId)
        .single();
      setSeller(data as any);
    }
    loadSeller();
  }, [sellerId]);

  if (!sellerId || items.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: '700' }}>Carrinho vazio</Text>
        <Button title="Voltar" onPress={() => navigation.goBack()} />
      </SafeAreaView>
    );
  }

  const shippingEstimateCents = seller?.shipping_fee_cents ?? 0;
  const totalEstimateCents = subtotalCents + shippingEstimateCents;

  async function payWithCard() {
    setLoading(true);
    try {
      // 1) Create order
      const order = await createOrder({
        sellerId,
        items: items.map((it) => ({
          productId: it.productId,
          variantId: it.variantId ?? null,
          quantity: it.quantity,
        })),
        deliveryNotes: notes || undefined,
      });

      // 2) Create payment sheet
      const ps = await createPaymentSheet(order.orderId);

      const initRes = await initPaymentSheet({
        merchantDisplayName: 'Pescados Marketplace',
        customerId: ps.customerId,
        customerEphemeralKeySecret: ps.customerEphemeralKeySecret,
        paymentIntentClientSecret: ps.paymentIntentClientSecret,
        // Apple Pay / Google Pay may show automatically depending on device + cards
        applePay: {
          merchantCountryCode: 'BR',
        },
        googlePay: {
          merchantCountryCode: 'BR',
          testEnv: __DEV__,
        },
        allowsDelayedPaymentMethods: true,
      });

      if (initRes.error) throw new Error(initRes.error.message);

      const presentRes = await presentPaymentSheet();
      if (presentRes.error) throw new Error(presentRes.error.message);

      Alert.alert('Pagamento enviado', 'Se o pagamento for aprovado, o fornecedor receberá o pedido por e-mail.');
      clear();
      navigation.navigate('Orders');
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Falha no pagamento');
    } finally {
      setLoading(false);
    }
  }

  async function payWithPix() {
    setLoading(true);
    try {
      const order = await createOrder({
        sellerId,
        items: items.map((it) => ({
          productId: it.productId,
          variantId: it.variantId ?? null,
          quantity: it.quantity,
        })),
        deliveryNotes: notes || undefined,
      });

      const pix = await createPixPayment(order.orderId);

      if (!pix.pix) {
        Alert.alert(
          'Pix indisponível',
          'Este ambiente/conta pode não ter Pix habilitado no provedor. Tente cartão.'
        );
        return;
      }

      clear();
      navigation.navigate('Pix', { orderId: order.orderId, pix: pix.pix, total: pix.total });
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Falha no Pix');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: '800' }}>Checkout</Text>

        <View style={{ backgroundColor: 'white', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#eee', gap: 6 }}>
          <Text style={{ fontWeight: '800' }}>Resumo</Text>
          <Text style={{ color: '#666' }}>Subtotal (estimado): {centsToBRL(subtotalCents)}</Text>
          <Text style={{ color: '#666' }}>Frete (fixo do fornecedor): {centsToBRL(shippingEstimateCents)}</Text>
          <Text style={{ fontSize: 16, fontWeight: '800', marginTop: 6 }}>Total estimado: {centsToBRL(totalEstimateCents)}</Text>
          {seller?.min_order_cents ? (
            <Text style={{ color: subtotalCents < seller.min_order_cents ? '#b91c1c' : '#166534', marginTop: 6 }}>
              Pedido mínimo: {centsToBRL(seller.min_order_cents)}
            </Text>
          ) : null}
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ fontWeight: '700' }}>Observações de entrega</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Ex: entregar na portaria / ligar antes"
            style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12 }}
            multiline
          />
        </View>

        <View style={{ gap: 10 }}>
          <Button title={loading ? 'Processando...' : 'Pagar com cartão / Apple Pay / Google Pay'} onPress={payWithCard} disabled={loading} />
          <Button title={loading ? 'Processando...' : 'Pagar com Pix'} onPress={payWithPix} disabled={loading} />
          <Button title="Voltar" onPress={() => navigation.goBack()} />
        </View>

        <Text style={{ color: '#666', fontSize: 12 }}>
          * Em produtos por caixa (peso variável), o valor é estimado. Em B2B pode haver ajuste de saldo após emissão da NF/peso final.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
