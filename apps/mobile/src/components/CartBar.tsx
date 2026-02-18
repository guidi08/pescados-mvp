import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { NavigationContainerRef } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCart } from '../context/CartContext';
import { colors, radius, shadow, spacing, textStyle } from '../theme';

function centsToBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function estimateCartKg(items: any[]): number {
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

    // If the product is sold per unit/box but has an estimated box weight, we can still estimate.
    if ((unit === 'cx' || unit === 'caixa') && it.estimatedBoxWeightKg) {
      total += Number(it.estimatedBoxWeightKg) * Number(it.quantity ?? 0);
    }
  }
  return total;
}

const HIDE_ON = new Set([
  'Entry',
  'SupplierAccess',
  'Login',
  'AuthCallback',
  'Cart',
  'Checkout',
  'Pix',
]);

const TAB_ROUTES = new Set(['SellersTab', 'ProductsTab', 'ProfileTab']);

export default function CartBar({ navigationRef }: { navigationRef: NavigationContainerRef<any> }) {
  const { items, totalCents } = useCart();
  const insets = useSafeAreaInsets();

  // Navigation may not be ready on first render
  if (!navigationRef.isReady?.()) return null;

  const currentRouteName = navigationRef.getCurrentRoute?.()?.name;
  if (currentRouteName && HIDE_ON.has(currentRouteName)) return null;

  if (!items.length) return null;

  const kg = useMemo(() => estimateCartKg(items as any), [items]);

  const bottomOffset = (currentRouteName && TAB_ROUTES.has(currentRouteName))
    ? (insets.bottom || 0) + 56
    : (insets.bottom || 0) + 8;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: bottomOffset,
        paddingHorizontal: spacing['4'],
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: colors.background.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border.subtle,
          ...shadow.md,
          overflow: 'hidden',
        }}
      >
        <View style={{ padding: spacing['3'], flex: 1 }}>
          <Text style={textStyle('caption')}>{items.length} {items.length === 1 ? 'item' : 'itens'}</Text>
          <Text style={textStyle('bodyStrong')}>{centsToBRL(totalCents)}</Text>
          <Text style={[textStyle('caption'), { color: colors.text.secondary }]}>≈ {kg.toFixed(1)} kg</Text>
        </View>

        <Pressable
          onPress={() => {
            if (!navigationRef.isReady()) return;
            navigationRef.navigate('Cart');
          }}
          style={({ pressed }) => ({
            paddingHorizontal: spacing['4'],
            paddingVertical: spacing['3'],
            backgroundColor: pressed ? colors.brand.primaryDark : colors.brand.primary,
          })}
        >
          <Text style={[textStyle('bodyStrong'), { color: colors.text.inverse }]}>Ver carrinho</Text>
        </Pressable>
      </View>
    </View>
  );
}
