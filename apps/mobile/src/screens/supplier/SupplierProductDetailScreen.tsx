import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, Switch, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../../supabaseClient';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Input from '../../components/Input';
import { colors, spacing, textStyle } from '../../theme';
import { centsToBRL } from '../../utils';

type Variant = {
  id: string;
  name: string;
  price_cents: number;
  active: boolean;
};

export default function SupplierProductDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const productId = route.params?.productId;

  const [product, setProduct] = useState<any>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [price, setPrice] = useState('');
  const [fresh, setFresh] = useState(false);
  const [active, setActive] = useState(true);
  const [estimatedWeight, setEstimatedWeight] = useState('');
  const [maxVar, setMaxVar] = useState('');
  const [saving, setSaving] = useState(false);

  // New variant form
  const [newVarName, setNewVarName] = useState('');
  const [newVarPrice, setNewVarPrice] = useState('');

  const load = useCallback(async () => {
    const { data: prod } = await supabase.from('products').select('*').eq('id', productId).single();
    if (prod) {
      setProduct(prod);
      setPrice(((prod.base_price_cents ?? 0) / 100).toFixed(2).replace('.', ','));
      setFresh(prod.fresh);
      setActive(prod.active);
      setEstimatedWeight(prod.estimated_box_weight_kg?.toString() ?? '');
      setMaxVar(prod.max_weight_variation_pct?.toString() ?? '0');
    }
    const { data: vars } = await supabase.from('product_variants').select('*').eq('product_id', productId).order('name');
    setVariants(vars ?? []);
  }, [productId]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    setSaving(true);
    try {
      const priceCents = Math.round(parseFloat(price.replace(',', '.')) * 100);
      const update: any = {
        base_price_cents: priceCents,
        fresh,
        active,
      };
      if (product?.pricing_mode === 'per_kg_box') {
        update.estimated_box_weight_kg = parseFloat(estimatedWeight.replace(',', '.')) || null;
        update.max_weight_variation_pct = parseFloat(maxVar.replace(',', '.')) || 0;
      }
      const { error } = await supabase.from('products').update(update).eq('id', productId);
      if (error) throw error;
      Alert.alert('Salvo', 'Produto atualizado com sucesso.');
      load();
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Falha ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function addVariant() {
    if (!newVarName.trim() || !newVarPrice.trim()) {
      Alert.alert('Preencha', 'Nome e preço da variante são obrigatórios.');
      return;
    }
    const priceCents = Math.round(parseFloat(newVarPrice.replace(',', '.')) * 100);
    const { error } = await supabase.from('product_variants').insert({
      product_id: productId,
      name: newVarName.trim(),
      price_cents: priceCents,
      active: true,
    });
    if (error) { Alert.alert('Erro', error.message); return; }
    setNewVarName('');
    setNewVarPrice('');
    load();
  }

  async function toggleVariant(v: Variant) {
    await supabase.from('product_variants').update({ active: !v.active }).eq('id', v.id);
    load();
  }

  async function deleteProduct() {
    Alert.alert('Excluir produto', 'Deseja desativar este produto?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desativar', style: 'destructive',
        onPress: async () => {
          await supabase.from('products').update({ active: false }).eq('id', productId);
          navigation.goBack();
        },
      },
    ]);
  }

  if (!product) return (
    <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background.app }}>
      <ActivityIndicator size="large" color={colors.brand.primary} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.app }}>
      <ScrollView contentContainerStyle={{ padding: spacing['4'], gap: spacing['4'] }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={textStyle('h2')} numberOfLines={1}>{product.name}</Text>
          <Button title="Voltar" variant="ghost" size="sm" onPress={() => navigation.goBack()} />
        </View>

        {/* Product config */}
        <Card>
          <View style={{ gap: spacing['3'] }}>
            <View style={{ flexDirection: 'row', gap: spacing['2'] }}>
              <Badge label={product.fresh ? 'Fresco' : 'Congelado'} variant={product.fresh ? 'fresh' : 'frozen'} />
              <Badge label={product.category} variant="neutral" />
              {product.pricing_mode === 'per_kg_box' && <Badge label="Peso variável" variant="variable" />}
            </View>

            <Input label="Preço base (R$)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />

            {product.pricing_mode === 'per_kg_box' && (
              <>
                <Input label="Peso estimado (kg)" value={estimatedWeight} onChangeText={setEstimatedWeight} keyboardType="decimal-pad" />
                <Input label="Variação máx (%)" value={maxVar} onChangeText={setMaxVar} keyboardType="decimal-pad" />
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

            <Button title={saving ? 'Salvando...' : 'Salvar alterações'} onPress={handleSave} disabled={saving} />
          </View>
        </Card>

        {/* Variants */}
        <Card>
          <Text style={[textStyle('bodyStrong'), { marginBottom: spacing['3'] }]}>Variantes / Calibres</Text>

          {variants.map(v => (
            <View key={v.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing['2'], borderBottomWidth: 1, borderBottomColor: colors.border.subtle }}>
              <View style={{ flex: 1 }}>
                <Text style={textStyle('body')}>{v.name}</Text>
                <Text style={[textStyle('caption'), { color: colors.text.secondary }]}>{centsToBRL(v.price_cents)}</Text>
              </View>
              <Switch value={v.active} onValueChange={() => toggleVariant(v)} trackColor={{ true: colors.brand.primary, false: colors.neutral[200] }} />
            </View>
          ))}

          <View style={{ marginTop: spacing['3'], gap: spacing['2'], paddingTop: spacing['3'], borderTopWidth: 1, borderTopColor: colors.border.subtle }}>
            <Text style={[textStyle('label'), { color: colors.text.secondary }]}>Adicionar variante</Text>
            <Input label="" value={newVarName} onChangeText={setNewVarName} placeholder="Nome (ex: 3-4kg)" />
            <Input label="" value={newVarPrice} onChangeText={setNewVarPrice} placeholder="Preço (R$)" keyboardType="decimal-pad" />
            <Button title="Adicionar" variant="secondary" size="sm" onPress={addVariant} />
          </View>
        </Card>

        <Button title="Desativar produto" variant="destructive" onPress={deleteProduct} />
      </ScrollView>
    </SafeAreaView>
  );
}
