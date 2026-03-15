import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';

export type BuyerChannel = 'b2b' | 'b2c';

export type BuyerProfile = {
  id: string;
  email: string | null;
  role: 'buyer' | 'seller' | 'admin' | string;
  full_name: string | null;
  phone: string | null;
  cpf: string | null;
  cnpj: string | null;
  company_name: string | null;
  seller_id: string | null;
  address?: {
    street?: string | null;
    number?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    complement?: string | null;
    reference?: string | null;
  } | null;
};

type BuyerContextValue = {
  loading: boolean;
  profile: BuyerProfile | null;
  channel: BuyerChannel;
  refresh: () => Promise<void>;
};

const BuyerContext = createContext<BuyerContextValue | null>(null);

async function maybeSyncProfileFromMetadata(profile: BuyerProfile, userId: string) {
  const { data: sessionData } = await supabase.auth.getSession();
  const sess = sessionData.session;
  if (!sess) return profile;

  const md = (sess.user.user_metadata ?? {}) as any;

  const patch: Partial<BuyerProfile> = {};

  // Name / phone
  if (!profile.full_name && md.full_name) patch.full_name = String(md.full_name);
  if (!profile.phone && md.phone) patch.phone = String(md.phone);

  // Doc info
  const docType = md.doc_type ? String(md.doc_type) : null;
  const docNumber = md.doc_number ? String(md.doc_number) : null;

  if (docType === 'cnpj' && docNumber && !profile.cnpj) {
    patch.cnpj = docNumber;
    if (!profile.company_name && md.company_name) patch.company_name = String(md.company_name);
    if (!profile.company_name && md.full_name) patch.company_name = String(md.full_name);
  }

  if (docType === 'cpf' && docNumber && !profile.cpf) {
    patch.cpf = docNumber;
  }

  if (!Object.keys(patch).length) return profile;

  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) {
    console.warn('[buyer] Profile sync failed:', error.message);
    return profile;
  }

  return { ...profile, ...patch };
}

export function BuyerProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<BuyerProfile | null>(null);

  // Memoize refresh to prevent re-render loops when used as useEffect dependency
  const refresh = useCallback(async () => {
    setLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const sess = sessionData.session;

      if (!sess) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const userId = sess.user.id;

      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role, full_name, phone, cpf, cnpj, company_name, seller_id, address')
        .eq('id', userId)
        .single();

      if (error || !data) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const synced = await maybeSyncProfileFromMetadata(data as any, userId);
      setProfile(synced as any);
    } catch (e) {
      console.warn('[buyer] Failed to load profile:', e);
      setProfile(null);
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

  const channel: BuyerChannel = useMemo(() => {
    if (!profile) return 'b2c';
    return profile.cnpj ? 'b2b' : 'b2c';
  }, [profile]);

  // Memoize context value
  const value = useMemo<BuyerContextValue>(
    () => ({ loading, profile, channel, refresh }),
    [loading, profile, channel, refresh]
  );

  return (
    <BuyerContext.Provider value={value}>
      {children}
    </BuyerContext.Provider>
  );
}

export function useBuyer() {
  const ctx = useContext(BuyerContext);
  if (!ctx) throw new Error('useBuyer must be used within BuyerProvider');
  return ctx;
}
