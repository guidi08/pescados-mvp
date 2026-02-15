import React from 'react';
import { Image, SafeAreaView, ScrollView, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import Button from '../components/Button';
import Card from '../components/Card';
import { colors, spacing, textStyle } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Pix'>;

export default function PixScreen({ route, navigation }: Props) {
  const { orderId, pix, total } = route.params;

  async function copy() {
    if (pix?.data) {
      await Clipboard.setStringAsync(pix.data);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.app }}>
      <ScrollView contentContainerStyle={{ padding: spacing['4'], gap: spacing['3'] }}>
        <Text style={textStyle('h1')}>Pague com Pix</Text>
        <Text style={[textStyle('small'), { color: colors.text.secondary }]}>Pedido: {orderId}</Text>
        <Text style={textStyle('h2')}>Total: {total}</Text>

        <Card style={{ alignItems: 'center' }}>
          {pix?.imageUrlPng ? (
            <Image source={{ uri: pix.imageUrlPng }} style={{ width: 260, height: 260 }} />
          ) : (
            <Text style={{ color: colors.text.secondary }}>
              Não foi possível carregar o QR Code (verifique se Pix está habilitado na Stripe).
            </Text>
          )}
        </Card>

        <Button title="Copiar código Pix" onPress={copy} />

        {pix?.hostedInstructionsUrl ? (
          <Text style={[textStyle('small'), { color: colors.text.secondary }]}>
            Dica: se preferir, abra o link de instruções Pix no navegador: {pix.hostedInstructionsUrl}
          </Text>
        ) : null}

        <Text style={[textStyle('caption'), { color: colors.text.tertiary }]}
        >
          Assim que o pagamento for confirmado, o pedido muda para “pago” automaticamente e o fornecedor recebe o pedido por e-mail.
        </Text>

        <View style={{ gap: spacing['2'] }}>
          <Button title="Ver meus pedidos" onPress={() => navigation.navigate('Orders')} />
          <Button title="Voltar ao início" onPress={() => navigation.navigate('Home')} variant="secondary" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
