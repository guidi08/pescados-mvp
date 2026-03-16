import React, { useState } from 'react';
import { Alert, SafeAreaView, ScrollView, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../supabaseClient';
import { useSeller } from '../../context/SellerContext';
import { classifyProduct } from '../../api';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Input from '../../components/Input';
import { colors, spacing, textStyle } from '../../theme';

const CATEGORIES = ['Peixes', 'Salmão', 'Camarão', 'Crustáceos', 'Mariscos', 'Outros'];

export default function SupplierProductNewScreen() {
  const navigation = useNavigation<any>();
  const { sellerId } = useSeller();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('Peixes');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState<'kg' | 'cx' | 'un'>('kg');
  const [pricingMode, setPricingMode] = useState<'per_unit' | 'per_kg_box'>('per_unit');
  const [estimatedBoxWeight, setEstimatedBoxWeight] = useState('');
  const [maxVariation, setMaxVariation] = useState('10');
  const [fresh, setFresh] = useState(true);
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!name.trim()) {
      Alert.alert('Campo obrigatório', 'Preencha o nome do produto.');
      return;
    }
    if (!price.trim() || isNaN(parseFloat(price))) {
      Alert.alert('Campo obrigatório', 'Preencha um preço válido.');
      return;
    }

    const priceCents = Math.round(parseFloat(price.replace(',', '.')) * 100);

    if (pricingMode === 'per_kg_box' && (!estimatedBoxWeight.trim() || isNaN(parseFloat(estimatedBoxWeight)))) {
      Alert.alert('Campo obrigatório', 'Preencha o peso estimado da caixa.');
      return;
    }

    setLoading(true);
    try {
      const insertData: any = {
        seller_id: sellerId,
        name: name.trim(),
        category,
        description: description.trim() || null,
        base_price_cents: priceCents,
        unit,
        pricing_mode: pricingMode,
        estimated_box_weight_kg: pricingMode === 'per_kg_box' ? parseFloat(estimatedBoxWeight.replace(',', '.')) : null,
        max_weight_variation_pct: pricingMode === 'per_kg_box' ? parseFloat(maxVariation.replace(',', '.')) : 0,
        fresh,
        active,
      };

      const { data, error } = await supabase.from('products').insert(insertData).select('id').single();
      if (error) throw error;

      // Trigger AI classification in background
      classifyProduct(data.id).catch(() => {});

      Alert.alert('Produto criado', `"${name}" foi adicionado ao catálogo.`);
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Falha ao criar produto');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.app }}>
      <ScrollView contentContainerStyle={{ padding: spacing['4'], gap: spacing['4'] }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={textStyle('h2')}>Novo Produto</Text>
          <Button title="Voltar" variant="ghost" size="sm" onPress={() => navigation.goBack()} />
        </View>

        <Card>
          <View style={{ gap: spacing['3'] }}>
            <Input label="Nome do produto" value={name} onChangeText={setName} placeholder="Ex: Salmão fresco" />

            <View style={{ gap: spacing['2'] }}>
              <Text style={[textStyle('label'), { color: colors.text.secondary }]}>Categoria</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing['2'] }}>
                {CATEGORIES.map(cat => (
                  <Button
                    key={cat}
                    title={cat}
                    size="sm"
                    variant={category === cat ? 'primary' : 'secondary'}
                    onPress={() => setCategory(cat)}
                  />
                ))}
              </View>
            </View>

            <Input label="Descrição (opcional)" value={description} onChangeText={setDescription} placeholder="Detalhes do produto" multiline />

            <Input label="Preço (R$)" value={price} onChangeText={setPrice} placeholder="0,00" keyboardType="decimal-pad" />

            <View style={{ gap: spacing['2'] }}>
              <Text style={[textStyle('label'), { color: colors.text.secondary }]}>Unidade</Text>
              <View style={{ flexDirection: 'row', gap: spacing['2'] }}>
                {(['kg', 'cx', 'un'] as const).map(u => (
                  <Button key={u} title={u.toUpperCase()} size="sm" variant={unit === u ? 'primary' : 'secondary'} onPress={() => setUnit(u)} />
                ))}
              </View>
            </View>

            <View style={{ gap: spacing['2'] }}>
              <Text style={[textStyle('label'), { color: colors.text.secondary }]}>Modo de preço</Text>
              <View style={{ flexDirection: 'row', gap: spacing['2'] }}>
                <Button title="Preço fixo" size="sm" variant={pricingMode === 'per_unit' ? 'primary' : 'secondary'} onPress={() => setPricingMode('per_unit')} />
                <Button title="Peso variável" size="sm" variant={pricingMode === 'per_kg_box' ? 'primary' : 'secondary'} onPress={() => setPricingMode('per_kg_box')} />
              </View>
            </View>

            {pricingMode === 'per_kg_box' && (
              <>
                <Input label="Peso estimado da caixa (kg)" value={estimatedBoxWeight} onChangeText={setEstimatedBoxWeight} placeholder="20" keyboardType="decimal-pad" />
                <Input label="Variação máxima (%)" value={maxVariation} onChangeText={setMaxVariation} placeholder="10" keyboardType="decimal-pad" />
              </>
            )}

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={textStyle('body')}>Fresco</Text>
              <Switch value={fresh} onValueChange={setFresh} trackColor={{ true: colors.brand.primary, false: colors.neutral[200] }} />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={textStyle('body')}>Ativo</Text>
              <Switch value={active} onValueChange={setActive} trackColor={{ true: colors.brand.primary, false: colors.neutral[200] }} />
            </View>
          </View>
        </Card>

        <Button title={loading ? 'Criando...' : 'Criar produto'} onPress={handleCreate} disabled={loading} />
      </ScrollView>
    </SafeAreaView>
  );
}
