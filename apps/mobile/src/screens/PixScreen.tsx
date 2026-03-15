import React, { useEffect, useState } from 'react';
import { Alert, Image, SafeAreaView, ScrollView, Text, View } from 'react-native';
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

  async function copy() {
    if (pix?.data) {
      await Clipboard.setStringAsync(pix.data);
      setCopied(true);
      // Reset after 3 seconds
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
          if (newStatus === 'paid' || payload.new?.status === 'paid') {
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
          <Text style={[textStyle('small'), { color: colors.text.secondary }]}>Pedido: {orderId}</Text>
        ) : null}
        <Text style={textStyle('h2')}>Total: {total}</Text>

        {paymentConfirmed ? (
          <Badge label="Pagamento confirmado ✅" variant="fresh" />
        ) : (
          <Text style={[textStyle('caption'), { color: colors.text.tertiary }]}>
            O Pix expira em até 30 minutos. Escaneie o QR Code ou copie o código abaixo.
          </Text>
        )}

        <Card style={{ alignItems: 'center' }}>
          {pix?.imageUrlPng ? (
            <Image source={{ uri: pix.imageUrlPng }} style={{ width: 260, height: 260 }} />
          ) : (
            <Text style={{ color: colors.text.secondary }}>
              Não foi possível carregar o QR Code (verifique se Pix está habilitado na Stripe).
            </Text>
          )}
        </Card>

        <Button
          title={copied ? '✓ Código copiado!' : 'Copiar código Pix'}
          onPress={copy}
          variant={copied ? 'secondary' : 'primary'}
        />

        {pix?.hostedInstructionsUrl ? (
          <Text style={[textStyle('small'), { color: colors.text.secondary }]}>
            Dica: se preferir, abra o link de instruções Pix no navegador: {pix.hostedInstructionsUrl}
          </Text>
        ) : null}

        <Text style={[textStyle('caption'), { color: colors.text.tertiary }]}
        >
          Assim que o pagamento for confirmado, o pedido muda para "pago" automaticamente e o fornecedor recebe o pedido por e-mail.
        </Text>

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
