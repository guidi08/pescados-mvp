import React from 'react';
import { Button, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { CartItem, useCart } from '../context/CartContext';

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
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: '800' }}>Carrinho</Text>
        {sellerName ? <Text style={{ color: '#666' }}>Fornecedor: {sellerName}</Text> : null}

        {!items.length ? (
          <Text style={{ color: '#666' }}>Seu carrinho está vazio.</Text>
        ) : (
          <>
            {items.map((it) => (
              <View
                key={`${it.productId}:${it.variantId ?? 'base'}`}
                style={{ backgroundColor: 'white', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#eee', gap: 8 }}
              >
                <Text style={{ fontSize: 16, fontWeight: '700' }}>
                  {it.productName} {it.variantName ? `(${it.variantName})` : ''}
                </Text>

                {it.pricingMode === 'per_kg_box' ? (
                  <Text style={{ color: '#666' }}>
                    {centsToBRL(it.unitPriceCents)} / kg • ~{it.estimatedBoxWeightKg ?? '—'}kg/caixa
                  </Text>
                ) : (
                  <Text style={{ color: '#666' }}>
                    {centsToBRL(it.unitPriceCents)} / {it.unit}
                  </Text>
                )}

                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  <Text style={{ fontWeight: '700' }}>Qtd:</Text>
                  <TextInput
                    value={String(it.quantity)}
                    onChangeText={(v) => {
                      const q = Number(v.replace(',', '.'));
                      if (!Number.isFinite(q)) return;
                      if (it.pricingMode === 'per_kg_box' && !Number.isInteger(q)) return;
                      updateQuantity(it.productId, it.variantId ?? null, q);
                    }}
                    keyboardType={it.pricingMode === 'per_kg_box' ? 'number-pad' : 'decimal-pad'}
                    style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 10, width: 90 }}
                  />
                  <Button title="Remover" onPress={() => removeItem(it.productId, it.variantId ?? null)} />
                </View>

                <Text style={{ color: '#111', fontWeight: '700' }}>
                  Total item: {centsToBRL(lineTotalCents(it))}
                </Text>

                {it.pricingMode === 'per_kg_box' ? (
                  <Text style={{ color: '#666', fontSize: 12 }}>
                    * Total estimado. Peso final pode variar (B2B: ajuste por saldo).
                  </Text>
                ) : null}
              </View>
            ))}

            <View style={{ backgroundColor: 'white', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#eee' }}>
              <Text style={{ fontSize: 18, fontWeight: '800' }}>Subtotal estimado: {centsToBRL(subtotalCents)}</Text>
              <Text style={{ color: '#666', marginTop: 6, fontSize: 12 }}>
                O frete (se houver) aparece no checkout e é definido pelo fornecedor.
              </Text>
            </View>

            <View style={{ gap: 10 }}>
              <Button title="Ir para checkout" onPress={() => navigation.navigate('Checkout')} />
              <Button title="Limpar carrinho" onPress={clear} />
            </View>
          </>
        )}

        <Button title="Voltar" onPress={() => navigation.goBack()} />
      </ScrollView>
    </SafeAreaView>
  );
}
