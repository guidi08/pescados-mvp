import React from 'react';
import { Alert, SafeAreaView, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import Button from '../components/Button';
import { colors, spacing, textStyle } from '../theme';

const SUPPORT_EMAIL = 'suporte@guestengine.io';

export default function SupplierAccessScreen() {
  const portalUrl = process.env.EXPO_PUBLIC_SUPPLIER_PORTAL_URL;

  async function openPortal() {
    if (!portalUrl) {
      Alert.alert(
        'Portal não configurado',
        'Defina EXPO_PUBLIC_SUPPLIER_PORTAL_URL no .env do app (ex.: https://seu-portal.vercel.app).'
      );
      return;
    }
    await Linking.openURL(portalUrl);
  }

  async function requestAccess() {
    const subject = encodeURIComponent('LotePro - Solicitação de cadastro de fornecedor');
    const body = encodeURIComponent(
      'Olá!\n\nQuero cadastrar minha empresa como fornecedora no LotePro.\n\nDados:\n- Empresa/Razão social:\n- CNPJ:\n- Nome do responsável:\n- Telefone:\n- Cidade/UF:\n\nObrigado!'
    );
    await Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.app }}>
      <View style={{ padding: spacing['5'], gap: spacing['3'] }}>
        <Text style={textStyle('h1')}>Área do fornecedor</Text>
        <Text style={[textStyle('body'), { color: colors.text.secondary }]}
        >
          Para manter o app leve e focado em compras, o gerenciamento de produtos, preços e pedidos é feito no Portal do Fornecedor.
        </Text>

        <View style={{ gap: spacing['2'], marginTop: spacing['2'] }}>
          <Button title="Abrir Portal do Fornecedor" onPress={openPortal} />
          <Button title="Solicitar cadastro" variant="secondary" onPress={requestAccess} />
        </View>

        <Text style={[textStyle('caption'), { color: colors.text.tertiary, marginTop: spacing['2'] }]}
        >
          Suporte: {SUPPORT_EMAIL}
        </Text>
      </View>
    </SafeAreaView>
  );
}
