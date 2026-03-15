import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../context/CartContext';
import { useBuyer } from '../context/BuyerContext';
import { createOrder, createPaymentSheet, createPixPayment } from '../api';
import { supabase } from '../supabaseClient';
import Button from '../components/Button';
import Card from '../components/Card';
import { colors, spacing, textStyle } from '../theme';
import { centsToBRL } from '../utils';
import { isStripeAvailable } from '../../App';

// Conditionally import useStripe — only works with native module present
const useStripe = isStripeAvailable
  ? require('@stripe/stripe-react-native').useStripe
  : () => ({ initPaymentSheet: async () => ({ error: { message: 'Stripe indispon\u00edvel no Expo Go. Use um dev client build.' } }), presentPaymentSheet: async () => ({ error: { message: 'Stripe indispon\u00edvel' } }) });

type Seller = {
  id: string;
  shipping_fee_cents: number;
  min_order_cents: number;
  cutoff_time: string;
};

export default function CheckoutScreen({ navigation }: any) {
  const { items, sellerId, clear, subtotalCents } = useCart();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { channel } = useBuyer();

  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false); // Prevent double-tap

  const [seller, setSeller] = useState<Seller | null>(null);
  const [address, setAddress] = useState<any>(null);

  useEffect(() => {
    async function loadData() {
      if (!sellerId) return;
      const { data, error } = await supabase
        .from('sellers')
        .select('id, shipping_fee_cents, min_order_cents, cutoff_time')
        .eq('id', sellerId)
        .single();
      if (error) console.warn('[checkout] Failed to load seller:', error.message);
      setSeller(data as any);

      // Load delivery address from profile
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('address')
          .eq('id', userId)
          .single();
        if (profile?.address) setAddress(profile.address);
      }
    }
    loadData();
  }, [sellerId]);

  // Refresh address when returning from AddressScreen
  useEffect(() => {
    const unsub = navigation.addListener('focus', async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('address')
          .eq('id', userId)
          .single();
        if (profile?.address) setAddress(profile.address);
      }
    });
    return unsub;
  }, [navigation]);

  const isB2C = channel === 'b2c';
  const addressMissing = isB2C && !address;

  if (!sellerId || items.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, padding: spacing['4'], backgroundColor: colors.background.app }}>
        <Text style={textStyle('h2')}>Carrinho vazio</Text>
        <Button title="Voltar" onPress={() => navigation.goBack()} variant="secondary" />
      </SafeAreaView>
    );
  }

  const shippingEstimateCents = seller?.shipping_fee_cents ?? 0;
  const totalEstimateCents = subtotalCents + shippingEstimateCents;

  // Check minimum order
  function checkMinOrder(): boolean {
    if (seller?.min_order_cents && subtotalCents < seller.min_order_cents) {
      Alert.alert(
        'Pedido abaixo do m\u00ednimo',
        `O pedido m\u00ednimo deste fornecedor \u00e9 ${centsToBRL(seller.min_order_cents)}. Seu subtotal atual \u00e9 ${centsToBRL(subtotalCents)}.`
      );
      return false;
    }
    return true;
  }

  function checkAddress(): boolean {
    if (addressMissing) {
      Alert.alert('Endere\u00e7o obrigat\u00f3rio', 'Cadastre um endere\u00e7o de entrega antes de finalizar.', [
        { text: 'Cadastrar', onPress: () => navigation.navigate('Address') },
        { text: 'Cancelar', style: 'cancel' },
      ]);
      return false;
    }
    return true;
  }

  async function payWithCard() {
    if (!sellerId) return;
    if (!checkAddress()) return;
    if (!checkMinOrder()) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
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
        deliveryAddress: address || undefined,
      });

      // 2) Create payment sheet
      const ps = await createPaymentSheet(order.orderId);

      const initRes = await initPaymentSheet({
        merchantDisplayName: 'LotePro',
        customerId: ps.customerId,
        customerEphemeralKeySecret: ps.customerEphemeralKeySecret,
        paymentIntentClientSecret: ps.paymentIntentClientSecret,
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

      // Only clear cart AFTER payment succeeds
      Alert.alert('Pagamento enviado', 'Se o pagamento for aprovado, o fornecedor receber\u00e1 o pedido por e-mail.');
      clear();
      navigation.navigate('Orders');
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Falha no pagamento');
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }

  async function payWithPix() {
    if (!sellerId) return;
    if (!checkAddress()) return;
    if (!checkMinOrder()) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
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
        deliveryAddress: address || undefined,
      });

      const pix = await createPixPayment(order.orderId);

      if (!pix.pix) {
        Alert.alert(
          'Pix indispon\u00edvel',
          'Este ambiente/conta pode n\u00e3o ter Pix habilitado no provedor. Tente cart\u00e3o.'
        );
        return;
      }

      // Navigate to Pix screen — DON'T clear cart until payment is confirmed
      // The cart will be cleared when the user returns from Pix or the order updates to 'paid'
      navigation.navigate('Pix', { orderId: order.orderId, pix: pix.pix, total: pix.total });
      // Clear after navigating so user can't double-submit
      clear();
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Falha no Pix');
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.app }}>
      <ScrollView contentContainerStyle={{ padding: spacing['4'], gap: spacing['3'] }}>
        <Text style={textStyle('h1')}>Checkout</Text>

        <Card>
          <Text style={textStyle('h3')}>Resumo</Text>
          <Text style={[textStyle('small'), { color: colors.text.secondary }]}>
            Subtotal (estimado): {centsToBRL(subtotalCents)}
          </Text>
          <Text style={[textStyle('small'), { color: colors.text.secondary }]}>
            Frete (fixo do fornecedor): {centsToBRL(shippingEstimateCents)}
          </Text>
          <Text style={[textStyle('bodyStrong'), { marginTop: spacing['2'] }]}
          >Total estimado: {centsToBRL(totalEstimateCents)}</Text>
          {seller?.min_order_cents ? (
            <Text style={{ color: subtotalCents < seller.min_order_cents ? colors.semantic.error : colors.semantic.success, marginTop: spacing['2'] }}>
              Pedido m\u00ednimo: {centsToBRL(seller.min_order_cents)}
            </Text>
          ) : null}
        </Card>

        {isB2C ? (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={textStyle('h3')}>Endere\u00e7o de entrega</Text>
              <Pressable onPress={() => navigation.navigate('Address')}>
                <Text style={{ color: colors.brand.primary, fontWeight: '600', fontSize: 14 }}>
                  {address ? 'Editar' : 'Cadastrar'}
                </Text>
              </Pressable>
            </View>
            {address ? (
              <Text style={[textStyle('small'), { color: colors.text.secondary, marginTop: spacing['2'] }]}>
                {address.street}, {address.number}
                {address.complement ? ` - ${address.complement}` : ''}
                {'\n'}{address.neighborhood} - {address.city}/{address.state}
                {'\n'}CEP: {address.postal_code}
              </Text>
            ) : (
              <View style={{ marginTop: spacing['2'], flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="warning" size={16} color={colors.semantic.error} />
                <Text style={[textStyle('small'), { color: colors.semantic.error }]}>
                  Endere\u00e7o obrigat\u00f3rio para finalizar
                </Text>
              </View>
            )}
          </Card>
        ) : null}

        <Card>
          <Text style={textStyle('label')}>Observa\u00e7\u00f5es de entrega</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Ex: entregar na portaria / ligar antes"
            placeholderTextColor={colors.text.tertiary}
            style={{ borderWidth: 1, borderColor: colors.border.default, borderRadius: 12, padding: 12, marginTop: spacing['2'], backgroundColor: colors.background.surface, color: colors.text.primary }}
            multiline
          />
        </Card>

        <View style={{ gap: spacing['2'] }}>
          <Button title={loading ? 'Processando...' : 'Pagar com cart\u00e3o / Apple Pay / Google Pay'} onPress={payWithCard} disabled={loading} />
          <Button title={loading ? 'Processando...' : 'Pagar com Pix'} onPress={payWithPix} disabled={loading} variant="secondary" />
          <Button title="Voltar" onPress={() => navigation.goBack()} variant="ghost" />
        </View>

        <Text style={[textStyle('caption'), { color: colors.text.tertiary }]}
        >
          * Em produtos por caixa (peso vari\u00e1vel), o valor \u00e9 estimado. Em B2B pode haver ajuste de saldo ap\u00f3s emiss\u00e3o da NF/peso final.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
