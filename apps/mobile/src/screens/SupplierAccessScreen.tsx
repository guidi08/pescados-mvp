import React from 'react';
import { SafeAreaView, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Button from '../components/Button';
import { colors, spacing, textStyle } from '../theme';

const SUPPORT_EMAIL = 'suporte@guestengine.io';

export default function SupplierAccessScreen() {
  const navigation = useNavigation<any>();

  async function requestAccess() {
    const subject = encodeURIComponent('LotePro - Solicitação de cadastro de fornecedor');
    const body = encodeURIComponent(
      'Olá!\n\nQuero cadastrar minha empresa como fornecedora no LotePro.\n\nDados:\n- Empresa/Razão social:\n- CNPJ:\n- Nome do responsável:\n- Telefone:\n- Cidade/UF:\n\nObrigado!'
    );
    await Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`).catch(() => {});
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.app }}>
      <View style={{ flex: 1, padding: spacing['5'], justifyContent: 'center', gap: spacing['4'] }}>
        <View style={{ alignItems: 'center', gap: spacing['3'] }}>
          <View style={{
            width: 72, height: 72, borderRadius: 36,
            backgroundColor: colors.brand.primary,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="storefront" size={36} color="#FFF" />
          </View>
          <Text style={textStyle('h1')}>Área do Fornecedor</Text>
          <Text style={[textStyle('body'), { color: colors.text.secondary, textAlign: 'center' }]}>
            Gerencie seus produtos, preços e pedidos diretamente pelo app.
          </Text>
        </View>

        <View style={{ gap: spacing['2'], marginTop: spacing['2'] }}>
          <Button
            title="Entrar como fornecedor"
            onPress={() => navigation.navigate('Login', { role: 'seller' })}
          />
          <Button title="Solicitar cadastro" variant="secondary" onPress={requestAccess} />
          <Button title="Voltar" variant="ghost" onPress={() => navigation.goBack()} />
        </View>

        <Text style={[textStyle('caption'), { color: colors.text.tertiary, textAlign: 'center', marginTop: spacing['2'] }]}>
          Suporte: {SUPPORT_EMAIL}
        </Text>
      </View>
    </SafeAreaView>
  );
}
