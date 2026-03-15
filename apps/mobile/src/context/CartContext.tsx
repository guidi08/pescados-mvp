import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, LayoutAnimation, Platform, UIManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '../supabaseClient';

export type PricingMode = 'per_unit' | 'per_kg_box';

export type CartItem = {
  productId: string;
  variantId?: string | null;

  productName: string;
  variantName?: string | null;

  unit: string; // kg, cx, un...
  pricingMode: PricingMode;

  // per_unit: price per unit
  // per_kg_box: price per kg
  unitPriceCents: number;

  // per_unit: quantity in unit
  // per_kg_box: quantity = number of boxes (integer)
  quantity: number;

  // only for per_kg_box
  estimatedBoxWeightKg?: number | null;
  maxWeightVariationPct?: number | null;
};

type CartState = {
  sellerId: string | null;
  sellerName: string | null;
  items: CartItem[];
};

type CartContextValue = CartState & {
  addItem: (sellerId: string, sellerName: string, item: CartItem) => void;
  updateQuantity: (productId: string, variantId: string | null | undefined, quantity: number) => void;
  removeItem: (productId: string, variantId: string | null | undefined) => void;
  clear: () => void;
  totalCents: number;
  subtotalCents: number;
  shippingFeeCents: number;
};

const CartContext = createContext<CartContextValue | null>(null);

const CART_STORAGE_KEY = '@lotepro/cart';

function lineTotalCents(it: CartItem): number {
  if (it.pricingMode === 'per_unit') {
    return Math.round(it.unitPriceCents * it.quantity);
  }
  const est = Number(it.estimatedBoxWeightKg ?? 0);
  return Math.round(it.unitPriceCents * est * it.quantity);
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CartState>({ sellerId: null, sellerName: null, items: [] });
  const [shippingFeeCents, setShippingFeeCents] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  // Persist cart to AsyncStorage
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state)).catch(() => {});
    }, 500);
  }, [state, hydrated]);

  // Hydrate cart from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem(CART_STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed && Array.isArray(parsed.items)) {
              setState(parsed);
            }
          } catch {}
        }
      })
      .finally(() => setHydrated(true));
  }, []);

  const subtotalCents = useMemo(() => {
    return state.items.reduce((acc, it) => acc + lineTotalCents(it), 0);
  }, [state.items]);

  useEffect(() => {
    let mounted = true;
    async function loadShipping() {
      if (!state.sellerId) {
        if (mounted) setShippingFeeCents(0);
        return;
      }

      const { data, error } = await supabase
        .from('sellers')
        .select('shipping_fee_cents')
        .eq('id', state.sellerId)
        .single();

      if (error) {
        console.warn('[cart] Failed to load shipping fee:', error.message);
      }

      if (!mounted) return;
      setShippingFeeCents(Number((data as any)?.shipping_fee_cents ?? 0));
    }
    loadShipping();
    return () => {
      mounted = false;
    };
  }, [state.sellerId]);

  const totalCents = subtotalCents + shippingFeeCents;

  function animateNext() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }

  const addItem = useCallback((sellerId: string, sellerName: string, item: CartItem) => {
    animateNext();
    setState((prev) => {
      // Enforce 1 seller per cart (estilo iFood) — confirm with user
      if (prev.sellerId && prev.sellerId !== sellerId) {
        // The confirmation is handled by the caller (ProductScreen)
        return { sellerId, sellerName, items: [item] };
      }

      const idx = prev.items.findIndex((i) => i.productId === item.productId && (i.variantId ?? null) === (item.variantId ?? null));
      if (idx >= 0) {
        const items = [...prev.items];
        // Update price to latest + add quantity
        items[idx] = {
          ...items[idx],
          quantity: items[idx].quantity + item.quantity,
          unitPriceCents: item.unitPriceCents, // Always update to latest price
        };
        return { sellerId, sellerName, items };
      }

      return { sellerId, sellerName, items: [...prev.items, item] };
    });
  }, []);

  const updateQuantity = useCallback((productId: string, variantId: string | null | undefined, quantity: number) => {
    animateNext();
    setState((prev) => {
      const items = prev.items
        .map((i) => {
          if (i.productId === productId && (i.variantId ?? null) === (variantId ?? null)) {
            return { ...i, quantity };
          }
          return i;
        })
        .filter((i) => i.quantity > 0);

      return { ...prev, items, ...(items.length ? {} : { sellerId: null, sellerName: null }) };
    });
  }, []);

  const removeItem = useCallback((productId: string, variantId: string | null | undefined) => {
    updateQuantity(productId, variantId, 0);
  }, [updateQuantity]);

  const clear = useCallback(() => {
    animateNext();
    setState({ sellerId: null, sellerName: null, items: [] });
    AsyncStorage.removeItem(CART_STORAGE_KEY).catch(() => {});
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo<CartContextValue>(
    () => ({
      ...state,
      addItem,
      updateQuantity,
      removeItem,
      clear,
      totalCents,
      subtotalCents,
      shippingFeeCents,
    }),
    [state, addItem, updateQuantity, removeItem, clear, totalCents, subtotalCents, shippingFeeCents]
  );

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
