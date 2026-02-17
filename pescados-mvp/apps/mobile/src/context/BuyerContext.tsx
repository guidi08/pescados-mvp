import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
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

  // We only attempt update if the user is logged in (has session). RLS will allow update on own row.
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) {
    // Ignore update errors; app will still function, user can complete profile manually.
    return profile;
  }

  return { ...profile, ...patch };
}

export function BuyerProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<BuyerProfile | null>(null);

  async function refresh() {
    setLoading(true);

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
      .select('id, email, role, full_name, phone, cpf, cnpj, company_name, seller_id')
      .eq('id', userId)
      .single();

    if (error || !data) {
      // If profile doesn't exist, we still keep user logged in, but treat as B2C.
      setProfile(null);
      setLoading(false);
      return;
    }

    const synced = await maybeSyncProfileFromMetadata(data as any, userId);

    setProfile(synced as any);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const channel: BuyerChannel = useMemo(() => {
    if (!profile) return 'b2c';
    return profile.cnpj ? 'b2b' : 'b2c';
  }, [profile]);

  return (
    <BuyerContext.Provider value={{ loading, profile, channel, refresh }}>
      {children}
    </BuyerContext.Provider>
  );
}

export function useBuyer() {
  const ctx = useContext(BuyerContext);
  if (!ctx) throw new Error('useBuyer must be used within BuyerProvider');
  return ctx;
}
