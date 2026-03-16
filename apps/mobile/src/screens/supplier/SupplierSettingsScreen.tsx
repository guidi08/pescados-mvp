import React, { useEffect, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, Switch, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../supabaseClient';
import { useSeller } from '../../context/SellerContext';
import { getStripeOnboardingLink } from '../../api';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Input from '../../components/Input';
import { colors, spacing, textStyle } from '../../theme';

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function SupplierSettingsScreen() {
  const navigation = useNavigation<any>();
  const { seller, sellerId, refresh } = useSeller();

  const [orderEmail, setOrderEmail] = useState('');
  const [cutoffTime, setCutoffTime] = useState('');
  const [shippingFee, setShippingFee] = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [b2cEnabled, setB2cEnabled] = useState(false);
  const [deliveryDays, setDeliveryDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [saving, setSaving] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);

  // Bank details
  const [bankName, setBankName] = useState('');
  const [bankAgency, setBankAgency] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankAccountType, setBankAccountType] = useState('corrente');
  const [bankPixKey, setBankPixKey] = useState('');
  const [bankHolderName, setBankHolderName] = useState('');
  const [bankHolderCnpj, setBankHolderCnpj] = useState('');

  useEffect(() => {
    if (!seller) return;
    setOrderEmail(seller.order_email ?? '');
    setCutoffTime(seller.cutoff_time ?? '18:00');
    setShippingFee(((seller.shipping_fee_cents ?? 0) / 100).toFixed(2).replace('.', ','));
    setMinOrder(((seller.min_order_cents ?? 0) / 100).toFixed(2).replace('.', ','));
    setB2cEnabled(seller.b2c_enabled);
    setDeliveryDays(seller.delivery_days ?? [1, 2, 3, 4, 5]);
    // Bank details
    setBankName(seller.bank_name ?? '');
    setBankAgency(seller.bank_agency ?? '');
    setBankAccount(seller.bank_account ?? '');
    setBankAccountType(seller.bank_account_type ?? 'corrente');
    setBankPixKey(seller.bank_pix_key ?? '');
    setBankHolderName(seller.bank_holder_name ?? '');
    setBankHolderCnpj(seller.bank_holder_cnpj ?? '');
  }, [seller]);

  function toggleDay(day: number) {
    setDeliveryDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      const update: any = {
        order_email: orderEmail.trim() || null,
        cutoff_time: cutoffTime.trim() || '18:00',
        shipping_fee_cents: Math.round(parseFloat(shippingFee.replace(',', '.')) * 100) || 0,
        min_order_cents: Math.round(parseFloat(minOrder.replace(',', '.')) * 100) || 0,
        b2c_enabled: b2cEnabled,
        delivery_days: deliveryDays,
        // Bank details
        bank_name: bankName.trim() || null,
        bank_agency: bankAgency.trim() || null,
        bank_account: bankAccount.trim() || null,
        bank_account_type: bankAccountType,
        bank_pix_key: bankPixKey.trim() || null,
        bank_holder_name: bankHolderName.trim() || null,
        bank_holder_cnpj: bankHolderCnpj.trim() || null,
      };
      const { error } = await supabase.from('sellers').update(update).eq('id', sellerId);
      if (error) throw error;
      await refresh();
      Alert.alert('Salvo', 'Configurações atualizadas.');
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Falha ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function handleStripeOnboarding() {
    if (!sellerId) return;
    setStripeLoading(true);
    try {
      const { url } = await getStripeOnboardingLink(sellerId);
      await Linking.openURL(url);
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Falha ao gerar link Stripe');
    } finally {
      setStripeLoading(false);
    }
  }

  async function handleLogout() {
    Alert.alert('Sair', 'Deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair', style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          navigation.reset({ index: 0, routes: [{ name: 'Entry' }] });
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.app }}>
      <ScrollView contentContainerStyle={{ padding: spacing['4'], gap: spacing['4'] }} keyboardShouldPersistTaps="handled">
        <Text style={textStyle('h2')}>Configurações</Text>

        {/* General settings */}
        <Card>
          <View style={{ gap: spacing['3'] }}>
            <Input label="E-mail para pedidos" value={orderEmail} onChangeText={setOrderEmail} placeholder="pedidos@suaempresa.com" keyboardType="email-address" />

            <Input label="Horário de corte" value={cutoffTime} onChangeText={setCutoffTime} placeholder="18:00" helperText="Pedidos após esse horário vão para D+2" />

            <Input label="Taxa de entrega (R$)" value={shippingFee} onChangeText={setShippingFee} placeholder="0,00" keyboardType="decimal-pad" />

            <Input label="Pedido mínimo (R$)" value={minOrder} onChangeText={setMinOrder} placeholder="0,00" keyboardType="decimal-pad" />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={textStyle('body')}>Vendas B2C (CPF)</Text>
              <Switch value={b2cEnabled} onValueChange={setB2cEnabled} trackColor={{ true: colors.brand.primary, false: colors.neutral[200] }} />
            </View>

            <View style={{ gap: spacing['2'] }}>
              <Text style={[textStyle('label'), { color: colors.text.secondary }]}>Dias de entrega</Text>
              <View style={{ flexDirection: 'row', gap: spacing['1'], flexWrap: 'wrap' }}>
                {DAYS.map((label, idx) => (
                  <Button
                    key={idx}
                    title={label}
                    size="sm"
                    variant={deliveryDays.includes(idx) ? 'primary' : 'secondary'}
                    onPress={() => toggleDay(idx)}
                  />
                ))}
              </View>
            </View>
          </View>
        </Card>

        {/* Bank details */}
        <Card>
          <Text style={[textStyle('bodyStrong'), { marginBottom: spacing['3'] }]}>Dados Bancários (Repasse)</Text>
          <View style={{ gap: spacing['3'] }}>
            <Input label="Titular da conta" value={bankHolderName} onChangeText={setBankHolderName} placeholder="Razão social ou nome completo" />

            <Input label="CNPJ / CPF" value={bankHolderCnpj} onChangeText={setBankHolderCnpj} placeholder="00.000.000/0001-00" keyboardType="numeric" />

            <Input label="Chave PIX" value={bankPixKey} onChangeText={setBankPixKey} placeholder="CNPJ, e-mail, telefone ou chave aleatória" />

            <Input label="Banco" value={bankName} onChangeText={setBankName} placeholder="Ex: Banco do Brasil, Itaú, Nubank" />

            <Input label="Agência" value={bankAgency} onChangeText={setBankAgency} placeholder="0001" keyboardType="numeric" />

            <Input label="Conta" value={bankAccount} onChangeText={setBankAccount} placeholder="12345-6" keyboardType="numeric" />

            <View style={{ gap: spacing['1'] }}>
              <Text style={[textStyle('label'), { color: colors.text.secondary }]}>Tipo de conta</Text>
              <View style={{ flexDirection: 'row', gap: spacing['2'] }}>
                <Button
                  title="Corrente"
                  size="sm"
                  variant={bankAccountType === 'corrente' ? 'primary' : 'secondary'}
                  onPress={() => setBankAccountType('corrente')}
                />
                <Button
                  title="Poupança"
                  size="sm"
                  variant={bankAccountType === 'poupanca' ? 'primary' : 'secondary'}
                  onPress={() => setBankAccountType('poupanca')}
                />
              </View>
            </View>
          </View>
        </Card>

        <Button title={saving ? 'Salvando...' : 'Salvar configurações'} onPress={handleSave} disabled={saving} />

        {/* Stripe */}
        <Card>
          <Text style={[textStyle('bodyStrong'), { marginBottom: spacing['3'] }]}>Pagamentos (Stripe)</Text>

          <View style={{ flexDirection: 'row', gap: spacing['2'], marginBottom: spacing['3'] }}>
            <Badge
              label={seller?.stripe_account_charges_enabled ? 'Cobranças ativas' : 'Cobranças inativas'}
              variant={seller?.stripe_account_charges_enabled ? 'fresh' : 'frozen'}
            />
            <Badge
              label={seller?.stripe_account_payouts_enabled ? 'Repasses ativos' : 'Repasses inativos'}
              variant={seller?.stripe_account_payouts_enabled ? 'fresh' : 'frozen'}
            />
          </View>

          <Button
            title={stripeLoading ? 'Carregando...' : seller?.stripe_account_id ? 'Atualizar Stripe' : 'Configurar Stripe'}
            variant="secondary"
            onPress={handleStripeOnboarding}
            disabled={stripeLoading}
          />
        </Card>

        <Button title="Sair da conta" variant="ghost" onPress={handleLogout} />
      </ScrollView>
    </SafeAreaView>
  );
}
