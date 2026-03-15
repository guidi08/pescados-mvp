import React, { useEffect, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { supabase } from '../supabaseClient';
import { useBuyer } from '../context/BuyerContext';
import Button from '../components/Button';
import Card from '../components/Card';
import { colors, spacing, textStyle } from '../theme';
import { formatCPF, formatCNPJ, formatPhone, isValidCPF, isValidCNPJ } from '../utils';

type DocType = 'cpf' | 'cnpj';

export default function AccountScreen() {
  const navigation = useNavigation<any>();
  const { profile, refresh } = useBuyer();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [docType, setDocType] = useState<DocType>('cpf');
  const [docNumber, setDocNumber] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name ?? '');
    setPhone(profile?.phone ?? '');

    if (profile?.cnpj) {
      setDocType('cnpj');
      setDocNumber(profile.cnpj);
      setCompanyName(profile.company_name ?? '');
    } else if (profile?.cpf) {
      setDocType('cpf');
      setDocNumber(profile.cpf);
      setCompanyName('');
    } else {
      setDocType('cpf');
      setDocNumber('');
      setCompanyName('');
    }
  }, [profile?.id]);

  function handleDocTypeSwitch(next: DocType) {
    if (next === docType) return;
    setDocType(next);
    setDocNumber(''); // Clear doc number when switching types
    if (next === 'cpf') setCompanyName('');
  }

  function handleDocNumberChange(value: string) {
    if (docType === 'cpf') {
      setDocNumber(formatCPF(value));
    } else {
      setDocNumber(formatCNPJ(value));
    }
  }

  function handlePhoneChange(value: string) {
    setPhone(formatPhone(value));
  }

  async function save() {
    // Basic validation
    if (!fullName.trim()) {
      Alert.alert('Campo obrigatório', 'Preencha o nome.');
      return;
    }

    const rawDoc = docNumber.replace(/\D/g, '');
    if (rawDoc) {
      if (docType === 'cpf' && !isValidCPF(rawDoc)) {
        Alert.alert('CPF inválido', 'Verifique o CPF digitado.');
        return;
      }
      if (docType === 'cnpj' && !isValidCNPJ(rawDoc)) {
        Alert.alert('CNPJ inválido', 'Verifique o CNPJ digitado.');
        return;
      }
    }

    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) throw new Error('Sessão não encontrada.');

      const patch: any = {
        full_name: fullName.trim() || null,
        phone: phone.replace(/\D/g, '') || null,
        company_name: docType === 'cnpj' ? (companyName || fullName || null) : null,
        cpf: docType === 'cpf' ? (rawDoc || null) : null,
        cnpj: docType === 'cnpj' ? (rawDoc || null) : null,
      };

      // Clear the other doc field
      if (docType === 'cpf') patch.cnpj = null;
      if (docType === 'cnpj') patch.cpf = null;

      const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
      if (error) throw error;

      await refresh();
      Alert.alert('Salvo', 'Dados atualizados.');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.app }}>
      <ScrollView contentContainerStyle={{ padding: spacing['4'], gap: spacing['3'] }} keyboardShouldPersistTaps="handled">
        <Text style={textStyle('h1')}>Dados da conta</Text>

        <Card>
          <Text style={textStyle('label')}>Nome / Responsável</Text>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder="Seu nome"
            placeholderTextColor={colors.text.tertiary}
            style={{
              marginTop: spacing['2'],
              borderWidth: 1,
              borderColor: colors.border.default,
              borderRadius: 12,
              padding: 12,
              backgroundColor: colors.background.surface,
              color: colors.text.primary,
            }}
          />

          <Text style={[textStyle('label'), { marginTop: spacing['3'] }]}>Telefone</Text>
          <TextInput
            value={phone}
            onChangeText={handlePhoneChange}
            placeholder="(11) 99999-9999"
            placeholderTextColor={colors.text.tertiary}
            keyboardType="phone-pad"
            style={{
              marginTop: spacing['2'],
              borderWidth: 1,
              borderColor: colors.border.default,
              borderRadius: 12,
              padding: 12,
              backgroundColor: colors.background.surface,
              color: colors.text.primary,
            }}
          />
        </Card>

        <Card>
          <Text style={textStyle('label')}>Tipo de cadastro</Text>
          <View style={{ flexDirection: 'row', gap: spacing['2'], marginTop: spacing['2'] }}>
            <Button
              title="CPF"
              size="sm"
              variant={docType === 'cpf' ? 'primary' : 'secondary'}
              onPress={() => handleDocTypeSwitch('cpf')}
            />
            <Button
              title="CNPJ"
              size="sm"
              variant={docType === 'cnpj' ? 'primary' : 'secondary'}
              onPress={() => handleDocTypeSwitch('cnpj')}
            />
          </View>

          {docType === 'cnpj' ? (
            <>
              <Text style={[textStyle('label'), { marginTop: spacing['3'] }]}>Razão social (opcional)</Text>
              <TextInput
                value={companyName}
                onChangeText={setCompanyName}
                placeholder="Empresa LTDA"
                placeholderTextColor={colors.text.tertiary}
                style={{
                  marginTop: spacing['2'],
                  borderWidth: 1,
                  borderColor: colors.border.default,
                  borderRadius: 12,
                  padding: 12,
                  backgroundColor: colors.background.surface,
                  color: colors.text.primary,
                }}
              />
            </>
          ) : null}

          <Text style={[textStyle('label'), { marginTop: spacing['3'] }]}>{docType.toUpperCase()}</Text>
          <TextInput
            value={docNumber}
            onChangeText={handleDocNumberChange}
            placeholder={docType === 'cpf' ? '000.000.000-00' : '00.000.000/0001-00'}
            placeholderTextColor={colors.text.tertiary}
            keyboardType="number-pad"
            style={{
              marginTop: spacing['2'],
              borderWidth: 1,
              borderColor: colors.border.default,
              borderRadius: 12,
              padding: 12,
              backgroundColor: colors.background.surface,
              color: colors.text.primary,
            }}
          />

          <Text style={[textStyle('caption'), { color: colors.text.secondary, marginTop: spacing['2'] }]}
          >
            Importante: CNPJ libera o canal B2B (mais fornecedores). CPF é canal B2C.
          </Text>
        </Card>

        <View style={{ gap: spacing['2'] }}>
          <Button title={saving ? 'Salvando…' : 'Salvar'} onPress={save} disabled={saving} />
          <Button title="Voltar" variant="secondary" onPress={() => navigation.goBack()} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
