import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';

export type SellerData = {
  id: string;
  display_name: string;
  legal_name: string | null;
  cnpj: string | null;
  order_email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  logo_url: string | null;
  active: boolean;
  cutoff_time: string;
  timezone: string;
  min_order_cents: number;
  shipping_fee_cents: number;
  b2c_enabled: boolean;
  delivery_days: number[] | null;
  risk_reserve_bps: number;
  risk_reserve_days: number;
  stripe_account_id: string | null;
  stripe_account_charges_enabled: boolean;
  stripe_account_payouts_enabled: boolean;
  // Bank details for manual payout
  bank_name: string | null;
  bank_agency: string | null;
  bank_account: string | null;
  bank_account_type: string | null;
  bank_pix_key: string | null;
  bank_holder_name: string | null;
  bank_holder_cnpj: string | null;
};

type SellerContextValue = {
  loading: boolean;
  seller: SellerData | null;
  sellerId: string | null;
  refresh: () => Promise<void>;
};

const SellerContext = createContext<SellerContextValue | null>(null);

export function SellerProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [seller, setSeller] = useState<SellerData | null>(null);
  const [sellerId, setSellerId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const sess = sessionData.session;
      if (!sess) {
        setSeller(null);
        setSellerId(null);
        setLoading(false);
        return;
      }

      const userId = sess.user.id;

      // Get seller_id from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('seller_id')
        .eq('id', userId)
        .single();

      if (!profile?.seller_id) {
        setSeller(null);
        setSellerId(null);
        setLoading(false);
        return;
      }

      setSellerId(profile.seller_id);

      // Get full seller data
      const { data: sellerData } = await supabase
        .from('sellers')
        .select('*')
        .eq('id', profile.seller_id)
        .single();

      setSeller(sellerData as SellerData | null);
    } catch (e) {
      console.warn('[seller] Failed to load seller:', e);
      setSeller(null);
      setSellerId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });
    return () => sub.subscription.unsubscribe();
  }, [refresh]);

  const value = useMemo<SellerContextValue>(
    () => ({ loading, seller, sellerId, refresh }),
    [loading, seller, sellerId, refresh]
  );

  return (
    <SellerContext.Provider value={value}>
      {children}
    </SellerContext.Provider>
  );
}

export function useSeller() {
  const ctx = useContext(SellerContext);
  if (!ctx) throw new Error('useSeller must be used within SellerProvider');
  return ctx;
}
