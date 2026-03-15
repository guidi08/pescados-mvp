import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { supabase } from '../supabaseClient';
import { useBuyer } from '../context/BuyerContext';
import Card from '../components/Card';
import { colors, spacing, textStyle } from '../theme';

const SUPPORT_EMAIL = 'suporte@guestengine.io';
const PORTAL_URL = process.env.EXPO_PUBLIC_SUPPLIER_PORTAL_URL ?? '';
const TERMS_URL = PORTAL_URL ? `${PORTAL_URL}/termos` : '';
const PRIVACY_URL = PORTAL_URL ? `${PORTAL_URL}/privacidade` : '';
const CANCEL_URL = PORTAL_URL ? `${PORTAL_URL}/cancelamento` : '';

function MenuItem({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
        <Ionicons name={icon} size={22} color={colors.text.primary} />
        <View style={{ flex: 1 }}>
          <Text style={textStyle('bodyStrong')}>{title}</Text>
          {subtitle ? <Text style={[textStyle('caption'), { color: colors.text.secondary, marginTop: 2 }]}>{subtitle}</Text> : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const { channel } = useBuyer();

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile() {
    try {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) return;
      const { data: p, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (error) console.warn('[profile] Load error:', error.message);
      setProfile(p);
    } catch (e) {
      console.warn('[profile] Load failed:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  // Refetch profile when screen gains focus (after editing in Account/Address)
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => { loadProfile(); });
    return unsub;
  }, [navigation]);

  const displayName = useMemo(() => {
    if (profile?.full_name) return profile.full_name;
    const doc = profile?.cnpj || profile?.cpf;
    return doc ? `Cliente ${String(doc).slice(-4)}` : 'Minha conta';
  }, [profile]);

  const docLabel = profile?.cnpj ? `CNPJ: ${profile.cnpj}` : profile?.cpf ? `CPF: ${profile.cpf}` : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.app }}>
      <ScrollView>
      <View style={{ padding: spacing['4'], paddingBottom: spacing['3'] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing['3'] }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: colors.background.surface,
              borderWidth: 1,
              borderColor: colors.border.subtle,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="person" size={26} color={colors.text.primary} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={textStyle('h2')}>{displayName}</Text>
            {docLabel ? <Text style={[textStyle('caption'), { color: colors.text.secondary, marginTop: 2 }]}>{docLabel}</Text> : null}
            <Text style={[textStyle('caption'), { color: colors.text.tertiary, marginTop: 2 }]}
            >
              Canal: {channel === 'b2b' ? 'B2B (empresa)' : 'B2C (consumidor)'}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ paddingHorizontal: spacing['4'], gap: spacing['3'], paddingBottom: spacing['6'] }}>
        <Card style={{ paddingVertical: 6 }}>
          <MenuItem
            icon="receipt-outline"
            title="Pedidos"
            subtitle="Acompanhe seus pedidos e histórico"
            onPress={() => navigation.navigate('Orders')}
          />

          <View style={{ height: 1, backgroundColor: colors.border.subtle, marginLeft: 38 }} />

          <MenuItem
            icon="person-circle-outline"
            title="Dados da conta"
            subtitle="Telefone e informações pessoais"
            onPress={() => navigation.navigate('Account')}
          />

          <View style={{ height: 1, backgroundColor: colors.border.subtle, marginLeft: 38 }} />

          <MenuItem
            icon="location-outline"
            title="Endereço de entrega"
            subtitle="Cadastre ou edite seu endereço"
            onPress={() => navigation.navigate('Address')}
          />

          {channel === 'b2b' ? (
            <>
              <View style={{ height: 1, backgroundColor: colors.border.subtle, marginLeft: 38 }} />
              <MenuItem
                icon="wallet-outline"
                title="Saldo (ajustes de peso)"
                subtitle="Créditos e débitos do peso final"
                onPress={() => navigation.navigate('Wallet')}
              />
            </>
          ) : null}
        </Card>

        <Card style={{ paddingVertical: 6 }}>
          {TERMS_URL ? (
            <>
              <MenuItem
                icon="document-text-outline"
                title="Termos de Uso"
                onPress={() => Linking.openURL(TERMS_URL).catch(() => {})}
              />
              <View style={{ height: 1, backgroundColor: colors.border.subtle, marginLeft: 38 }} />
            </>
          ) : null}
          {PRIVACY_URL ? (
            <>
              <MenuItem
                icon="shield-checkmark-outline"
                title="Política de Privacidade"
                onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})}
              />
              <View style={{ height: 1, backgroundColor: colors.border.subtle, marginLeft: 38 }} />
            </>
          ) : null}
          {CANCEL_URL ? (
            <>
              <MenuItem
                icon="return-down-back-outline"
                title="Cancelamento e Reembolso"
                onPress={() => Linking.openURL(CANCEL_URL).catch(() => {})}
              />
              <View style={{ height: 1, backgroundColor: colors.border.subtle, marginLeft: 38 }} />
            </>
          ) : null}
          <MenuItem
            icon="help-circle-outline"
            title="Suporte"
            subtitle={SUPPORT_EMAIL}
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {})}
          />
        </Card>

        <Card style={{ paddingVertical: 6 }}>
          <MenuItem
            icon="log-out-outline"
            title="Sair"
            onPress={async () => {
              try {
                await supabase.auth.signOut();
              } catch (e) {
                console.warn('[profile] Sign out error:', e);
              }
              navigation.reset({ index: 0, routes: [{ name: 'Entry' }] as any });
            }}
          />

          <View style={{ height: 1, backgroundColor: colors.border.subtle, marginLeft: 38 }} />

          <MenuItem
            icon="trash-outline"
            title="Excluir conta"
            subtitle="Solicitar exclusão dos seus dados"
            onPress={() => {
              Alert.alert(
                'Excluir conta',
                `Para solicitar a exclusão da sua conta e dados, envie um e-mail para ${SUPPORT_EMAIL} com o assunto "Exclusão de conta".`,
                [
                  { text: 'Enviar e-mail', onPress: () => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Exclus%C3%A3o%20de%20conta`).catch(() => {}) },
                  { text: 'Cancelar', style: 'cancel' },
                ]
              );
            }}
          />
        </Card>

        <Text style={[textStyle('caption'), { color: colors.text.tertiary, textAlign: 'center', marginTop: 8 }]}
        >
          LotePro • Marketplace de proteínas
        </Text>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}
