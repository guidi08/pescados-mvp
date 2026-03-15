import React, { useEffect, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { supabase } from '../supabaseClient';
import Button from '../components/Button';
import Input from '../components/Input';
import { colors, spacing, textStyle } from '../theme';
import { formatCEP } from '../utils';

type AddressFields = {
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  postal_code: string;
  reference: string;
};

const EMPTY: AddressFields = {
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  postal_code: '',
  reference: '',
};

export default function AddressScreen({ navigation }: any) {
  const [address, setAddress] = useState<AddressFields>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;
        if (!userId) {
          // No session — stop loading to avoid infinite spinner
          if (mounted) setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('address')
          .eq('id', userId)
          .single();

        if (error) console.warn('[address] Load error:', error.message);

        if (mounted && data?.address) {
          setAddress({ ...EMPTY, ...(data.address as any) });
        }
      } catch (e) {
        console.warn('[address] Load failed:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  function update(field: keyof AddressFields, value: string) {
    if (field === 'postal_code') {
      setAddress((prev) => ({ ...prev, [field]: formatCEP(value) }));
    } else {
      setAddress((prev) => ({ ...prev, [field]: value }));
    }
  }

  async function save() {
    if (!address.street || !address.number || !address.neighborhood || !address.city || !address.state || !address.postal_code) {
      Alert.alert('Campos obrigatórios', 'Preencha rua, número, bairro, cidade, estado e CEP.');
      return;
    }

    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) throw new Error('Usuário não autenticado');

      // Store raw digits for postal_code
      const addressToSave = {
        ...address,
        postal_code: address.postal_code.replace(/\D/g, ''),
      };

      const { error } = await supabase
        .from('profiles')
        .update({ address: addressToSave })
        .eq('id', userId);

      if (error) throw error;

      Alert.alert('Endereço salvo', 'Seu endereço de entrega foi atualizado.');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Falha ao salvar endereço');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background.app }}>
        <Text style={textStyle('body')}>Carregando...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.app }}>
      <ScrollView contentContainerStyle={{ padding: spacing['4'], gap: spacing['3'] }} keyboardShouldPersistTaps="handled">
        <Text style={[textStyle('body'), { color: colors.text.secondary, marginBottom: spacing['2'] }]}>
          Informe o endereço para entrega dos seus pedidos.
        </Text>

        <Input label="Rua / Avenida *" value={address.street} onChangeText={(v) => update('street', v)} placeholder="Ex: Rua das Flores" />

        <View style={{ flexDirection: 'row', gap: spacing['2'] }}>
          <View style={{ flex: 1 }}>
            <Input label="Número *" value={address.number} onChangeText={(v) => update('number', v)} placeholder="123" keyboardType="numeric" />
          </View>
          <View style={{ flex: 1.5 }}>
            <Input label="Complemento" value={address.complement} onChangeText={(v) => update('complement', v)} placeholder="Apt 4B" />
          </View>
        </View>

        <Input label="Bairro *" value={address.neighborhood} onChangeText={(v) => update('neighborhood', v)} placeholder="Centro" />

        <View style={{ flexDirection: 'row', gap: spacing['2'] }}>
          <View style={{ flex: 2 }}>
            <Input label="Cidade *" value={address.city} onChangeText={(v) => update('city', v)} placeholder="São Paulo" />
          </View>
          <View style={{ flex: 1 }}>
            <Input label="Estado *" value={address.state} onChangeText={(v) => update('state', v)} placeholder="SP" maxLength={2} autoCapitalize="characters" />
          </View>
        </View>

        <Input label="CEP *" value={address.postal_code} onChangeText={(v) => update('postal_code', v)} placeholder="01000-000" keyboardType="numeric" />

        <Input label="Referência" value={address.reference} onChangeText={(v) => update('reference', v)} placeholder="Próximo ao mercado" />

        <View style={{ marginTop: spacing['2'], gap: spacing['2'] }}>
          <Button title={saving ? 'Salvando...' : 'Salvar endereço'} onPress={save} disabled={saving} />
          <Button title="Cancelar" onPress={() => navigation.goBack()} variant="ghost" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
