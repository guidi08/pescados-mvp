import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import type { NavigationContainerRef } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
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
  'OrderDetail',
]);

const TAB_ROUTES = new Set(['SellersTab', 'ProductsTab', 'ProfileTab']);

export default function CartBar({ navigationRef }: { navigationRef: NavigationContainerRef<any> }) {
  const { items, sellerName, subtotalCents } = useCart();
  const insets = useSafeAreaInsets();

  const currentRouteName = navigationRef.getCurrentRoute?.()?.name;
  if (currentRouteName && HIDE_ON.has(currentRouteName)) return null;
  if (!items.length) return null;

  const kg = useMemo(() => estimateCartKg(items as any), [items]);

  const bottomOffset =
    currentRouteName && TAB_ROUTES.has(currentRouteName)
      ? (insets.bottom || 0) + 64
      : (insets.bottom || 0) + 8;

  // Smooth entrance (simple)
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [anim]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });

  const totalLabel = centsToBRL(subtotalCents);
  const itemsLabel = `${items.length} ${items.length === 1 ? 'item' : 'itens'}`;

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
      <Animated.View
        style={{
          transform: [{ translateY }],
          opacity: anim,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'stretch',
            backgroundColor: colors.background.surface,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border.subtle,
            ...shadow.md,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              flex: 1,
              paddingHorizontal: spacing['3'],
              paddingVertical: spacing['3'],
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing['2'],
            }}
          >
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: colors.background.app,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: colors.border.subtle,
              }}
            >
              <Ionicons name="bag-handle" size={18} color={colors.text.primary} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[textStyle('caption'), { color: colors.text.secondary }]}>Total sem a entrega</Text>
              <Text style={textStyle('bodyStrong')}>
                {totalLabel} <Text style={[textStyle('caption'), { color: colors.text.secondary }]}>/ {itemsLabel}</Text>
              </Text>
              <Text style={[textStyle('caption'), { color: colors.text.tertiary }]}>
                {sellerName ? `${sellerName} • ` : ''}≈ {kg.toFixed(1)} kg
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => {
              if (!navigationRef.isReady()) return;
              navigationRef.navigate('Cart');
            }}
            style={({ pressed }) => ({
              minWidth: 130,
              paddingHorizontal: spacing['4'],
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? colors.brand.primaryDark : colors.brand.primary,
            })}
          >
            <Text style={[textStyle('bodyStrong'), { color: colors.text.inverse }]}>Ver carrinho</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}
