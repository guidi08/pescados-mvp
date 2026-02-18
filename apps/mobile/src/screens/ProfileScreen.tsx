import React from 'react';
import { Alert, SafeAreaView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useNavigation } from '@react-navigation/native';

import { supabase } from '../supabaseClient';
import { useBuyer } from '../context/BuyerContext';
import Card from '../components/Card';
import Badge from '../components/Badge';
import { colors, spacing, textStyle } from '../theme';

const SUPPORT_EMAIL = 'suporte@guestengine.io';

type RowProps = {
  icon: any;
  label: string;
  value?: string;
  onPress: () => void;
  danger?: boolean;
};

function Row({ icon, label, value, onPress, danger }: RowProps) {
  return (
    <TouchableOpacity onPress={onPress}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: spacing['3'],
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing['3'] }}>
          <Ionicons name={icon} size={22} color={danger ? colors.semantic.error : colors.text.secondary} />
          <View>
            <Text style={[textStyle('bodyStrong'), danger ? { color: colors.semantic.error } : null]}>{label}</Text>
            {value ? <Text style={[textStyle('caption'), { color: colors.text.secondary }]}>{value}</Text> : null}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
      </View>
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const { profile, channel } = useBuyer();

  const displayName = profile?.company_name || profile?.full_name || profile?.email || 'Minha conta';
  const doc = profile?.cnpj ? `CNPJ: ${profile.cnpj}` : profile?.cpf ? `CPF: ${profile.cpf}` : 'Cadastro incompleto';

  async function logout() {
    await supabase.auth.signOut();
  }

  async function contactSupport() {
    const subject = encodeURIComponent('LotePro - Suporte');
    const body = encodeURIComponent('Olá!\n\nPreciso de ajuda com:');
    await Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.app }}>
      <View style={{ padding: spacing['4'], gap: spacing['3'] }}>
        <Text style={textStyle('h1')}>Perfil</Text>

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ gap: spacing['1'], flex: 1 }}>
              <Text style={textStyle('h3')}>{displayName}</Text>
              <Text style={[textStyle('caption'), { color: colors.text.secondary }]}>{doc}</Text>
            </View>
            <Badge label={channel === 'b2b' ? 'B2B' : 'B2C'} variant={channel === 'b2b' ? 'b2b' : 'b2c'} />
          </View>

          {!profile?.cnpj && !profile?.cpf ? (
            <Text style={[textStyle('caption'), { color: colors.semantic.warning, marginTop: spacing['2'] }]}
            >
              Complete seu CPF/CNPJ em “Dados da conta” para liberar o canal correto.
            </Text>
          ) : null}
        </Card>

        <Card>
          <Row
            icon="receipt-outline"
            label="Meus pedidos"
            value="Histórico e detalhes"
            onPress={() => navigation.navigate('Orders')}
          />
          <View style={{ height: 1, backgroundColor: colors.border.subtle }} />
          <Row
            icon="card-outline"
            label="Pagamentos"
            value="Cartão e Pix"
            onPress={() => Alert.alert('Em breve', 'No MVP, você escolhe Pix ou Cartão no checkout.')}
          />
          {channel === 'b2b' ? (
            <>
              <View style={{ height: 1, backgroundColor: colors.border.subtle }} />
              <Row
                icon="wallet-outline"
                label="Ajustes (saldo)"
                value="Créditos/Débitos por peso"
                onPress={() => navigation.navigate('Wallet')}
              />
            </>
          ) : null}
          <View style={{ height: 1, backgroundColor: colors.border.subtle }} />
          <Row
            icon="person-outline"
            label="Dados da conta"
            value="CPF/CNPJ, telefone"
            onPress={() => navigation.navigate('Account')}
          />
          <View style={{ height: 1, backgroundColor: colors.border.subtle }} />
          <Row
            icon="mail-outline"
            label="Suporte"
            value={SUPPORT_EMAIL}
            onPress={contactSupport}
          />
          <View style={{ height: 1, backgroundColor: colors.border.subtle }} />
          <Row
            icon="log-out-outline"
            label="Sair"
            danger
            onPress={() => {
              Alert.alert('Sair', 'Deseja sair da sua conta?', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Sair', style: 'destructive', onPress: logout },
              ]);
            }}
          />
        </Card>
      </View>
    </SafeAreaView>
  );
}
