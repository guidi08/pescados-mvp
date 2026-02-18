import React, { useEffect, useMemo, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';
import Button from '../components/Button';
import Card from '../components/Card';
import { colors, spacing, textStyle } from '../theme';
import { createWalletTopupPaymentSheet, createWalletTopupPix, getWalletMe } from '../api';

function centsToBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function WalletScreen({ navigation }: any) {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [loading, setLoading] = useState(true);
  const [balanceCents, setBalanceCents] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);

  const isNegative = balanceCents < 0;
  const amountDueCents = useMemo(() => (isNegative ? Math.abs(balanceCents) : 0), [balanceCents, isNegative]);

  async function load() {
    setLoading(true);
    try {
      const data = await getWalletMe();
      setBalanceCents(Number(data.balanceCents ?? 0));
      setTransactions(data.transactions ?? []);
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível carregar o saldo.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function payWithCard() {
    if (!amountDueCents) return;
    setLoading(true);
    try {
      const ps = await createWalletTopupPaymentSheet(amountDueCents);
      const initRes = await initPaymentSheet({
        merchantDisplayName: 'LotePro',
        customerId: ps.customerId,
        customerEphemeralKeySecret: ps.customerEphemeralKeySecret,
        paymentIntentClientSecret: ps.paymentIntentClientSecret,
        applePay: { merchantCountryCode: 'BR' },
        googlePay: { merchantCountryCode: 'BR', testEnv: __DEV__ },
        allowsDelayedPaymentMethods: true,
      });
      if (initRes.error) throw new Error(initRes.error.message);

      const presentRes = await presentPaymentSheet();
      if (presentRes.error) throw new Error(presentRes.error.message);

      Alert.alert('Pago ✅', 'Seu saldo será atualizado assim que o pagamento for confirmado.');
      await load();
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Falha no pagamento.');
    } finally {
      setLoading(false);
    }
  }

  async function payWithPix() {
    if (!amountDueCents) return;
    setLoading(true);
    try {
      const pix = await createWalletTopupPix(amountDueCents);
      if (!pix.pix) {
        Alert.alert('Pix indisponível', 'Pix pode não estar habilitado no provedor. Tente cartão.');
        return;
      }
      navigation.navigate('Pix', { orderId: 'saldo', pix: pix.pix, total: pix.total });
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Falha no Pix.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.app }}>
      <ScrollView contentContainerStyle={{ padding: spacing['4'], gap: spacing['3'] }}>
        <Text style={textStyle('h1')}>Saldo</Text>

        <Card>
          <Text style={textStyle('h3')}>Saldo atual</Text>
          <Text style={[textStyle('display'), { marginTop: spacing['2'] }]}>
            {centsToBRL(balanceCents)}
          </Text>
          <Text style={[textStyle('caption'), { color: colors.text.tertiary, marginTop: spacing['2'] }]}>
            O saldo é usado para ajustes de peso variável (B2B). Se ficar negativo, você precisa quitar para fazer novos pedidos.
          </Text>
        </Card>

        {isNegative ? (
          <Card>
            <Text style={textStyle('h3')}>Saldo negativo</Text>
            <Text style={[textStyle('small'), { color: colors.text.secondary, marginTop: spacing['2'] }]}>
              Valor a quitar: {centsToBRL(amountDueCents)}
            </Text>

            <View style={{ gap: spacing['2'], marginTop: spacing['3'] }}>
              <Button title={loading ? 'Aguarde...' : 'Pagar com cartão'} onPress={payWithCard} disabled={loading} />
              <Button title={loading ? 'Aguarde...' : 'Pagar com Pix'} onPress={payWithPix} disabled={loading} variant="secondary" />
            </View>
          </Card>
        ) : null}

        <Card>
          <Text style={textStyle('h3')}>Últimos lançamentos</Text>
          {transactions.length ? (
            <View style={{ gap: spacing['2'], marginTop: spacing['2'] }}>
              {transactions.slice(0, 10).map((t) => (
                <View key={t.id} style={{ borderBottomWidth: 1, borderBottomColor: colors.border.subtle, paddingBottom: spacing['2'] }}>
                  <Text style={textStyle('bodyStrong')}>{t.kind}</Text>
                  <Text style={[textStyle('small'), { color: colors.text.secondary }]}>
                    {t.note ?? ''}
                  </Text>
                  <Text style={[textStyle('small'), { color: colors.text.secondary }]}>
                    {centsToBRL(Number(t.amount_cents ?? 0))} • {new Date(t.created_at).toLocaleString('pt-BR')}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[textStyle('small'), { color: colors.text.secondary, marginTop: spacing['2'] }]}>
              Nenhum lançamento ainda.
            </Text>
          )}
        </Card>

        <View style={{ gap: spacing['2'] }}>
          <Button title="Atualizar" onPress={load} variant="secondary" />
          <Button title="Voltar" onPress={() => navigation.goBack()} variant="ghost" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
