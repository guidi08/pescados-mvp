import React from 'react';
import { Button, Image, SafeAreaView, ScrollView, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Pix'>;

export default function PixScreen({ route, navigation }: Props) {
  const { orderId, pix, total } = route.params;

  async function copy() {
    if (pix?.data) {
      await Clipboard.setStringAsync(pix.data);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: '800' }}>Pague com Pix</Text>
        <Text style={{ color: '#666' }}>Pedido: {orderId}</Text>
        <Text style={{ fontSize: 18, fontWeight: '700' }}>Total: {total}</Text>

        {pix?.imageUrlPng ? (
          <View style={{ alignItems: 'center' }}>
            <Image source={{ uri: pix.imageUrlPng }} style={{ width: 260, height: 260 }} />
          </View>
        ) : (
          <Text style={{ color: '#666' }}>
            Não foi possível carregar o QR Code (verifique se Pix está habilitado na Stripe).
          </Text>
        )}

        <Button title="Copiar código Pix" onPress={copy} />

        {pix?.hostedInstructionsUrl ? (
          <Text style={{ color: '#666' }}>
            Dica: se preferir, abra o link de instruções Pix no navegador: {pix.hostedInstructionsUrl}
          </Text>
        ) : null}

        <Text style={{ color: '#777', fontSize: 12 }}>
          Assim que o pagamento for confirmado, o pedido muda para “pago” automaticamente e o fornecedor recebe o pedido por e-mail.
        </Text>

        <View style={{ gap: 10 }}>
          <Button title="Ver meus pedidos" onPress={() => navigation.navigate('Orders')} />
          <Button title="Voltar ao início" onPress={() => navigation.navigate('Home')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
