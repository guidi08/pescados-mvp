import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { supabase } from '../supabaseClient';
import { CartItem, useCart } from '../context/CartContext';
import Card from '../components/Card';
import { colors, radius, shadow, spacing, textStyle } from '../theme';

type ProductSuggestion = {
  id: string;
  seller_id: string;
  name: string;
  base_price_cents: number;
  unit: string;
  pricing_mode: 'per_unit' | 'per_kg_box';
  fresh: boolean;
  estimated_box_weight_kg: number | null;
  max_weight_variation_pct: number | null;
};

function centsToBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function lineTotalCents(it: CartItem): number {
  if (it.pricingMode === 'per_unit') {
    return Math.round(it.unitPriceCents * it.quantity);
  }
  const est = Number(it.estimatedBoxWeightKg ?? 0);
  return Math.round(it.unitPriceCents * est * it.quantity);
}

function estimateCartKg(items: CartItem[]): number {
  let total = 0;
  for (const it of items) {
    if (it.pricingMode === 'per_kg_box') {
      const est = Number(it.estimatedBoxWeightKg ?? 0);
      total += est * Number(it.quantity ?? 0);
      continue;
    }

    const unit = String(it.unit ?? '').toLowerCase();
    if (unit === 'kg') {
      total += Number(it.quantity ?? 0);
      continue;
    }

    if ((unit === 'cx' || unit === 'caixa') && it.estimatedBoxWeightKg) {
      total += Number(it.estimatedBoxWeightKg) * Number(it.quantity ?? 0);
    }
  }
  return total;
}

function QtyStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border.subtle,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: colors.background.surface,
      }}
    >
      <Pressable
        onPress={() => onChange(Math.max(0, value - 1))}
        style={({ pressed }) => ({
          paddingHorizontal: 12,
          paddingVertical: 10,
          backgroundColor: pressed ? colors.background.app : colors.background.surface,
        })}
      >
        <Ionicons name="remove" size={18} color={colors.text.primary} />
      </Pressable>

      <View style={{ minWidth: 32, alignItems: 'center' }}>
        <Text style={textStyle('bodyStrong')}>{value}</Text>
      </View>

      <Pressable
        onPress={() => onChange(value + 1)}
        style={({ pressed }) => ({
          paddingHorizontal: 12,
          paddingVertical: 10,
          backgroundColor: pressed ? colors.background.app : colors.background.surface,
        })}
      >
        <Ionicons name="add" size={18} color={colors.text.primary} />
      </Pressable>
    </View>
  );
}

export default function CartScreen() {
  const navigation = useNavigation<any>();
  const { sellerId, sellerName, items, subtotalCents, shippingFeeCents, totalCents, updateQuantity, addItem, clear } = useCart();

  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);

  const approxKg = useMemo(() => estimateCartKg(items), [items]);

  useEffect(() => {
    let mounted = true;

    async function loadSuggestions() {
      if (!sellerId) {
        if (mounted) setSuggestions([]);
        return;
      }

      const { data } = await supabase
        .from('products')
        .select('id,seller_id,name,base_price_cents,unit,pricing_mode,fresh,estimated_box_weight_kg,max_weight_variation_pct')
        .eq('seller_id', sellerId)
        .eq('active', true)
        .order('updated_at', { ascending: false })
        .limit(12);

      const inCart = new Set(items.map((i) => i.productId));
      const list = (data ?? []) as any as ProductSuggestion[];
      const filtered = list.filter((p) => !inCart.has(p.id)).slice(0, 8);
      if (mounted) setSuggestions(filtered);
    }

    loadSuggestions();
    return () => {
      mounted = false;
    };
  }, [sellerId, items]);

  const header = (
    <View style={{ paddingHorizontal: spacing['4'], paddingBottom: spacing['3'] }}>
      {/* Seller header */}
      <View style={{ marginTop: spacing['2'] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: colors.background.app,
                borderWidth: 1,
                borderColor: colors.border.subtle,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="storefront" size={18} color={colors.text.primary} />
            </View>
            <View>
              <Text style={textStyle('h3')}>{sellerName ?? 'Fornecedor'}</Text>
              <Text style={[textStyle('caption'), { color: colors.text.secondary, marginTop: 2 }]}
              >
                Total sem a entrega: {centsToBRL(subtotalCents)}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => {
              // Voltar para fornecedor (se existir) ou para lista
              navigation.goBack();
            }}
          >
            <Text style={[textStyle('bodyStrong'), { color: colors.brand.primary }]}>Adicionar mais itens</Text>
          </Pressable>
        </View>
      </View>

      {/* Suggestions */}
      {suggestions.length ? (
        <View style={{ marginTop: spacing['4'] }}>
          <Text style={textStyle('h2')}>Precisa de mais alguma coisa?</Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={suggestions}
            keyExtractor={(p) => p.id}
            contentContainerStyle={{ gap: spacing['3'], paddingVertical: spacing['3'] }}
            renderItem={({ item }) => (
              <Card style={{ width: 180, padding: spacing['3'] }}>
                <Text style={textStyle('bodyStrong')} numberOfLines={2}>{item.name}</Text>
                <Text style={[textStyle('caption'), { color: colors.text.secondary, marginTop: 6 }]}
                >
                  {item.pricing_mode === 'per_kg_box'
                    ? `${centsToBRL(item.base_price_cents)}/kg`
                    : `${centsToBRL(item.base_price_cents)}/${item.unit}`}
                </Text>

                <Pressable
                  onPress={() => {
                    if (!sellerId || !sellerName) return;
                    addItem(sellerId, sellerName, {
                      productId: item.id,
                      productName: item.name,
                      unit: item.unit,
                      pricingMode: item.pricing_mode,
                      unitPriceCents: item.base_price_cents,
                      quantity: 1,
                      estimatedBoxWeightKg: item.estimated_box_weight_kg,
                      maxWeightVariationPct: item.max_weight_variation_pct,
                    });
                  }}
                  style={({ pressed }) => ({
                    marginTop: spacing['3'],
                    alignSelf: 'flex-start',
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: 999,
                    backgroundColor: pressed ? colors.brand.primaryDark : colors.brand.primary,
                  })}
                >
                  <Text style={[textStyle('caption'), { color: colors.text.inverse }]}>Adicionar</Text>
                </Pressable>
              </Card>
            )}
          />
        </View>
      ) : null}

      <View style={{ marginTop: spacing['4'], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={textStyle('h2')}>Lista de compra</Text>
        <Text style={[textStyle('caption'), { color: colors.text.tertiary }]}>≈ {approxKg.toFixed(1)} kg</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.app }}>
      {/* iFood-like header */}
      <View
        style={{
          paddingHorizontal: spacing['4'],
          paddingTop: spacing['3'],
          paddingBottom: spacing['2'],
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-down" size={26} color={colors.brand.primary} />
        </Pressable>

        <Text style={[textStyle('h3'), { letterSpacing: 1 }]}>SACOLA</Text>

        <Pressable
          onPress={clear}
          hitSlop={10}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Text style={[textStyle('bodyStrong'), { color: colors.brand.primary }]}>Limpar</Text>
        </Pressable>
      </View>

      <FlatList
        data={items}
        keyExtractor={(it) => `${it.productId}:${it.variantId ?? ''}`}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 140 }}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: spacing['4'], paddingBottom: spacing['3'] }}>
            <Card style={{ padding: spacing['3'] }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing['3'] }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: colors.background.app,
                    borderWidth: 1,
                    borderColor: colors.border.subtle,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="cube-outline" size={18} color={colors.text.primary} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={textStyle('bodyStrong')}>{item.productName}</Text>
                  {item.variantName ? (
                    <Text style={[textStyle('caption'), { color: colors.text.secondary, marginTop: 2 }]}
                    >
                      {item.variantName}
                    </Text>
                  ) : null}

                  <Text style={[textStyle('caption'), { color: colors.text.secondary, marginTop: 6 }]}
                  >
                    {item.pricingMode === 'per_kg_box'
                      ? `${centsToBRL(item.unitPriceCents)}/kg`
                      : `${centsToBRL(item.unitPriceCents)}/${item.unit}`}
                  </Text>

                  {item.pricingMode === 'per_kg_box' && item.estimatedBoxWeightKg ? (
                    <Text style={[textStyle('caption'), { color: colors.text.tertiary, marginTop: 2 }]}
                    >
                      Caixa ~{item.estimatedBoxWeightKg}kg (variação máx. {item.maxWeightVariationPct ?? 10}%)
                    </Text>
                  ) : null}

                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing['3'] }}>
                    <QtyStepper
                      value={item.quantity}
                      onChange={(next) => updateQuantity(item.productId, item.variantId ?? null, next)}
                    />

                    <Text style={textStyle('bodyStrong')}>{centsToBRL(lineTotalCents(item))}</Text>
                  </View>
                </View>
              </View>
            </Card>
          </View>
        )}
        ListEmptyComponent={
          <View style={{ padding: spacing['5'] }}>
            <Text style={textStyle('h2')}>Sua sacola está vazia</Text>
            <Text style={[textStyle('body'), { color: colors.text.secondary, marginTop: spacing['2'] }]}
            >
              Adicione produtos para continuar.
            </Text>
          </View>
        }
      />

      {/* Bottom total bar */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: spacing['4'],
          backgroundColor: colors.background.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border.subtle,
          ...shadow.sm,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <View>
            <Text style={[textStyle('caption'), { color: colors.text.secondary }]}>Total com a entrega</Text>
            <Text style={textStyle('h2')}>{centsToBRL(totalCents)}</Text>
            {shippingFeeCents ? (
              <Text style={[textStyle('caption'), { color: colors.text.tertiary, marginTop: 2 }]}
              >
                Inclui frete {centsToBRL(shippingFeeCents)}
              </Text>
            ) : (
              <Text style={[textStyle('caption'), { color: colors.text.tertiary, marginTop: 2 }]}>Frete grátis</Text>
            )}
          </View>

          <Pressable
            disabled={!items.length}
            onPress={() => navigation.navigate('Checkout')}
            style={({ pressed }) => ({
              paddingHorizontal: 18,
              paddingVertical: 14,
              borderRadius: 14,
              backgroundColor: !items.length
                ? colors.border.default
                : pressed
                  ? colors.brand.primaryDark
                  : colors.brand.primary,
            })}
          >
            <Text style={[textStyle('bodyStrong'), { color: colors.text.inverse }]}>Continuar</Text>
          </Pressable>
        </View>

        <Text style={[textStyle('caption'), { color: colors.text.tertiary }]}
        >
          {items.length} {items.length === 1 ? 'item' : 'itens'} • ≈ {approxKg.toFixed(1)} kg
        </Text>
      </View>
    </SafeAreaView>
  );
}
