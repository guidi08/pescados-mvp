import React, { useEffect, useState } from 'react';
import { Alert, SafeAreaView, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { supabase } from '../supabaseClient';
import { useBuyer } from '../context/BuyerContext';
import Button from '../components/Button';
import Card from '../components/Card';
import { colors, spacing, textStyle } from '../theme';

export default function AddressScreen() {
  const navigation = useNavigation<any>();
  const { profile, refresh } = useBuyer();

  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [complement, setComplement] = useState('');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const addr = (profile as any)?.address ?? {};
    setStreet(addr.street ?? '');
    setNumber(addr.number ?? '');
    setNeighborhood(addr.neighborhood ?? '');
    setCity(addr.city ?? '');
    setState(addr.state ?? '');
    setPostalCode(addr.postal_code ?? '');
    setComplement(addr.complement ?? '');
    setReference(addr.reference ?? '');
  }, [profile?.id]);

  async function save() {
    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) throw new Error('Sessão não encontrada.');

      const address = {
        street: street || null,
        number: number || null,
        neighborhood: neighborhood || null,
        city: city || null,
        state: state || null,
        postal_code: postalCode || null,
        complement: complement || null,
        reference: reference || null,
      };

      const { error } = await supabase.from('profiles').update({ address }).eq('id', userId);
      if (error) throw error;

      await refresh();
      Alert.alert('Salvo', 'Endereço atualizado.');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.app }}>
      <View style={{ padding: spacing['4'], gap: spacing['3'] }}>
        <Text style={textStyle('h1')}>Endereço de entrega</Text>

        <Card>
          <Text style={textStyle('label')}>Rua</Text>
          <TextInput
            value={street}
            onChangeText={setStreet}
            placeholder="Rua"
            placeholderTextColor={colors.text.tertiary}
            style={{ marginTop: spacing['2'], borderWidth: 1, borderColor: colors.border.default, borderRadius: 12, padding: 12, backgroundColor: colors.background.surface, color: colors.text.primary }}
          />

          <Text style={[textStyle('label'), { marginTop: spacing['3'] }]}>Número</Text>
          <TextInput
            value={number}
            onChangeText={setNumber}
            placeholder="Número"
            placeholderTextColor={colors.text.tertiary}
            style={{ marginTop: spacing['2'], borderWidth: 1, borderColor: colors.border.default, borderRadius: 12, padding: 12, backgroundColor: colors.background.surface, color: colors.text.primary }}
          />

          <Text style={[textStyle('label'), { marginTop: spacing['3'] }]}>Bairro</Text>
          <TextInput
            value={neighborhood}
            onChangeText={setNeighborhood}
            placeholder="Bairro"
            placeholderTextColor={colors.text.tertiary}
            style={{ marginTop: spacing['2'], borderWidth: 1, borderColor: colors.border.default, borderRadius: 12, padding: 12, backgroundColor: colors.background.surface, color: colors.text.primary }}
          />

          <Text style={[textStyle('label'), { marginTop: spacing['3'] }]}>Cidade</Text>
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder="Cidade"
            placeholderTextColor={colors.text.tertiary}
            style={{ marginTop: spacing['2'], borderWidth: 1, borderColor: colors.border.default, borderRadius: 12, padding: 12, backgroundColor: colors.background.surface, color: colors.text.primary }}
          />

          <Text style={[textStyle('label'), { marginTop: spacing['3'] }]}>Estado</Text>
          <TextInput
            value={state}
            onChangeText={setState}
            placeholder="UF"
            placeholderTextColor={colors.text.tertiary}
            style={{ marginTop: spacing['2'], borderWidth: 1, borderColor: colors.border.default, borderRadius: 12, padding: 12, backgroundColor: colors.background.surface, color: colors.text.primary }}
          />

          <Text style={[textStyle('label'), { marginTop: spacing['3'] }]}>CEP</Text>
          <TextInput
            value={postalCode}
            onChangeText={setPostalCode}
            placeholder="00000-000"
            placeholderTextColor={colors.text.tertiary}
            keyboardType="number-pad"
            style={{ marginTop: spacing['2'], borderWidth: 1, borderColor: colors.border.default, borderRadius: 12, padding: 12, backgroundColor: colors.background.surface, color: colors.text.primary }}
          />

          <Text style={[textStyle('label'), { marginTop: spacing['3'] }]}>Complemento</Text>
          <TextInput
            value={complement}
            onChangeText={setComplement}
            placeholder="Apto, bloco, etc."
            placeholderTextColor={colors.text.tertiary}
            style={{ marginTop: spacing['2'], borderWidth: 1, borderColor: colors.border.default, borderRadius: 12, padding: 12, backgroundColor: colors.background.surface, color: colors.text.primary }}
          />

          <Text style={[textStyle('label'), { marginTop: spacing['3'] }]}>Referência</Text>
          <TextInput
            value={reference}
            onChangeText={setReference}
            placeholder="Ponto de referência"
            placeholderTextColor={colors.text.tertiary}
            style={{ marginTop: spacing['2'], borderWidth: 1, borderColor: colors.border.default, borderRadius: 12, padding: 12, backgroundColor: colors.background.surface, color: colors.text.primary }}
          />
        </Card>

        <View style={{ gap: spacing['2'] }}>
          <Button title={saving ? 'Salvando…' : 'Salvar'} onPress={save} disabled={saving} />
          <Button title="Voltar" variant="secondary" onPress={() => navigation.goBack()} />
        </View>
      </View>
    </SafeAreaView>
  );
}
