import React from 'react';
import { SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { CartItem, useCart } from '../context/CartContext';
import Button from '../components/Button';
import Card from '../components/Card';
import { colors, spacing, textStyle } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Cart'>;

function centsToBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function lineTotalCents(it: CartItem): number {
  if (it.pricingMode === 'per_unit') return Math.round(it.unitPriceCents * it.quantity);
  const est = Number(it.estimatedBoxWeightKg ?? 0);
  return Math.round(it.unitPriceCents * est * it.quantity);
}

export default function CartScreen({ navigation }: Props) {
  const { items, sellerName, updateQuantity, removeItem, clear, subtotalCents } = useCart();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.app }}>
      <ScrollView contentContainerStyle={{ padding: spacing['4'], gap: spacing['3'] }}>
        <Text style={textStyle('h1')}>Carrinho</Text>
        {sellerName ? (
          <Text style={[textStyle('small'), { color: colors.text.secondary }]}>Fornecedor: {sellerName}</Text>
        ) : null}

        {!items.length ? (
          <Text style={{ color: colors.text.secondary }}>Seu carrinho está vazio.</Text>
        ) : (
          <>
            {items.map((it) => (
              <Card key={`${it.productId}:${it.variantId ?? 'base'}`}>
                <Text style={textStyle('h3')}>
                  {it.productName} {it.variantName ? `(${it.variantName})` : ''}
                </Text>

                {it.pricingMode === 'per_kg_box' ? (
                  <Text style={[textStyle('small'), { color: colors.text.secondary }]}
                  >
                    {centsToBRL(it.unitPriceCents)} / kg • ~{it.estimatedBoxWeightKg ?? '—'}kg/caixa
                  </Text>
                ) : (
                  <Text style={[textStyle('small'), { color: colors.text.secondary }]}
                  >
                    {centsToBRL(it.unitPriceCents)} / {it.unit}
                  </Text>
                )}

                <View style={{ flexDirection: 'row', gap: spacing['2'], alignItems: 'center', marginTop: spacing['2'] }}>
                  <Text style={textStyle('label')}>Qtd:</Text>
                  <TextInput
                    value={String(it.quantity)}
                    onChangeText={(v) => {
                      const q = Number(v.replace(',', '.'));
                      if (!Number.isFinite(q)) return;
                      if (it.pricingMode === 'per_kg_box' && !Number.isInteger(q)) return;
                      updateQuantity(it.productId, it.variantId ?? null, q);
                    }}
                    keyboardType={it.pricingMode === 'per_kg_box' ? 'number-pad' : 'decimal-pad'}
                    placeholderTextColor={colors.text.tertiary}
                    style={{ borderWidth: 1, borderColor: colors.border.default, borderRadius: 12, padding: 10, width: 90, backgroundColor: colors.background.surface, color: colors.text.primary }}
                  />
                  <Button title="Remover" onPress={() => removeItem(it.productId, it.variantId ?? null)} size="sm" variant="secondary" />
                </View>

                <Text style={[textStyle('bodyStrong'), { marginTop: spacing['2'] }]}
                >
                  Total item: {centsToBRL(lineTotalCents(it))}
                </Text>

                {it.pricingMode === 'per_kg_box' ? (
                  <Text style={[textStyle('caption'), { color: colors.text.tertiary, marginTop: spacing['2'] }]}
                  >
                    * Total estimado. Peso final pode variar (B2B: ajuste por saldo).
                  </Text>
                ) : null}
              </Card>
            ))}

            <Card>
              <Text style={textStyle('h2')}>Subtotal estimado: {centsToBRL(subtotalCents)}</Text>
              <Text style={[textStyle('caption'), { color: colors.text.secondary, marginTop: spacing['2'] }]}
              >
                O frete (se houver) aparece no checkout e é definido pelo fornecedor.
              </Text>
            </Card>

            <View style={{ gap: spacing['2'] }}>
              <Button title="Ir para checkout" onPress={() => navigation.navigate('Checkout')} />
              <Button title="Limpar carrinho" onPress={clear} variant="ghost" />
            </View>
          </>
        )}

        <Button title="Voltar" onPress={() => navigation.goBack()} variant="secondary" />
      </ScrollView>
    </SafeAreaView>
  );
}
