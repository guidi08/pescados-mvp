import React, { useEffect, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { supabase } from '../supabaseClient';
import Button from '../components/Button';
import Card from '../components/Card';
import Badge from '../components/Badge';
import { colors, spacing, textStyle } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Pix'>;

export default function PixScreen({ route, navigation }: Props) {
  const { orderId, pix, total } = route.params;
  const [copied, setCopied] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);

  const pixCode = pix?.data ?? '';

  async function copy() {
    if (pixCode) {
      await Clipboard.setStringAsync(pixCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  }

  // Subscribe to realtime payment status changes
  useEffect(() => {
    if (!orderId || orderId === 'saldo') return;

    const channel = supabase
      .channel(`pix-order-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        (payload: any) => {
          const newStatus = payload.new?.payment_status;
          if (newStatus === 'succeeded' || payload.new?.status === 'paid') {
            setPaymentConfirmed(true);
            Alert.alert(
              'Pagamento confirmado! ✅',
              'Seu pagamento via Pix foi recebido. O fornecedor já foi notificado.',
              [{ text: 'Ver pedidos', onPress: () => navigation.navigate('Orders') }]
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, navigation]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.app }}>
      <ScrollView contentContainerStyle={{ padding: spacing['4'], gap: spacing['3'] }}>
        <Text style={textStyle('h1')}>Pague com Pix</Text>
        {orderId !== 'saldo' ? (
          <Text style={[textStyle('small'), { color: colors.text.secondary }]}>Pedido: {orderId.slice(0, 8)}...</Text>
        ) : null}
        <Text style={textStyle('h2')}>Total: {total}</Text>

        {paymentConfirmed ? (
          <Badge label="Pagamento confirmado ✅" variant="fresh" />
        ) : (
          <Card>
            <View style={{ gap: spacing['2'] }}>
              <Text style={[textStyle('bodyStrong'), { color: colors.brand.primary }]}>
                Como pagar:
              </Text>
              <Text style={textStyle('body')}>1. Copie o código PIX abaixo</Text>
              <Text style={textStyle('body')}>2. Abra o app do seu banco</Text>
              <Text style={textStyle('body')}>3. Escolha "Pix Copia e Cola"</Text>
              <Text style={textStyle('body')}>4. Cole o código e confirme o pagamento</Text>
            </View>
          </Card>
        )}

        {/* PIX Code display */}
        <Card>
          <Text style={[textStyle('label'), { color: colors.text.secondary, marginBottom: spacing['2'] }]}>
            Código PIX (copia e cola):
          </Text>
          <View style={{
            backgroundColor: colors.neutral[50],
            padding: spacing['3'],
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.border.subtle,
          }}>
            <Text style={{
              fontFamily: 'monospace',
              fontSize: 11,
              color: colors.text.primary,
              lineHeight: 18,
            }} selectable>
              {pixCode || 'Código PIX indisponível'}
            </Text>
          </View>
        </Card>

        <Button
          title={copied ? '✓ Código copiado!' : 'Copiar código Pix'}
          onPress={copy}
          variant={copied ? 'secondary' : 'primary'}
        />

        {!paymentConfirmed && (
          <Text style={[textStyle('caption'), { color: colors.text.tertiary }]}>
            Após o pagamento, o fornecedor confirmará o recebimento e seu pedido será processado.
            Você receberá uma notificação quando o pagamento for confirmado.
          </Text>
        )}

        <View style={{ gap: spacing['2'] }}>
          <Button title="Ver meus pedidos" onPress={() => navigation.navigate('Orders')} />
          <Button
            title="Voltar ao início"
            onPress={() => navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] as any })}
            variant="secondary"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
