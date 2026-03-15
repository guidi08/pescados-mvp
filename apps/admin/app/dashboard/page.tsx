'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

type Profile = {
  id: string;
  role: 'buyer' | 'seller' | 'admin';
  seller_id: string | null;
};

type Seller = {
  id: string;
  display_name: string;
  order_email: string;
  logo_url?: string | null;
  cutoff_time: string;
  active: boolean;

  shipping_fee_cents: number;
  min_order_cents: number;
  b2c_enabled: boolean;
  delivery_days?: number[] | null;

  stripe_account_id: string | null;
  stripe_account_charges_enabled: boolean;
  stripe_account_payouts_enabled: boolean;

  risk_reserve_bps?: number | null;
  risk_reserve_days?: number | null;
};

type Product = {
  id: string;
  seller_id: string;
  name: string;
  fresh: boolean;
  min_expiry_date: string | null;
  active: boolean;
  base_price_cents: number;
  unit: string;
  pricing_mode: 'per_unit' | 'per_kg_box';
  estimated_box_weight_kg: number | null;
  max_weight_variation_pct: number | null;
  updated_at: string;
};

function centsToBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function brlToCents(input: string): number {
  const n = Number(String(input).replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

const DAY_OPTIONS = [
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sab' },
  { value: 7, label: 'Dom' },
];

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const sellerId = profile?.seller_id ?? null;

  async function load() {
    setLoading(true);
    setMsg(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) {
      window.location.href = '/login';
      return;
    }

    const userId = session.user.id;

    const { data: prof, error: profErr } = await supabase
      .from('profiles')
      .select('id, role, seller_id')
      .eq('id', userId)
      .single();

    if (profErr) {
      setMsg('Nao foi possivel carregar seu perfil. Verifique RLS e se o trigger de profile esta ativo.');
      setLoading(false);
      return;
    }

    setProfile(prof as any);

    if (!(prof as any).seller_id) {
      setMsg('Seu usuario nao esta vinculado a um fornecedor (seller_id).');
      setLoading(false);
      return;
    }

    const sid = (prof as any).seller_id as string;

    const [{ data: s, error: sErr }, { data: prods, error: pErr }] = await Promise.all([
      supabase.from('sellers').select('*').eq('id', sid).single(),
      supabase.from('products').select('*').eq('seller_id', sid).order('updated_at', { ascending: false }),
    ]);

    if (sErr) setMsg(sErr.message);
    setSeller(s as any);

    if (pErr) setMsg(pErr.message);
    setProducts((prods ?? []) as any);

    const channel = supabase
      .channel('realtime-products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products', filter: `seller_id=eq.${sid}` }, () => {
        supabase.from('products').select('*').eq('seller_id', sid).order('updated_at', { ascending: false })
          .then(({ data }) => setProducts((data ?? []) as any));
      })
      .subscribe();

    setLoading(false);

    return () => { supabase.removeChannel(channel); };
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeCount = useMemo(() => products.filter(p => p.active).length, [products]);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  async function updateProduct(id: string, patch: Partial<Product>) {
    setMsg(null);
    const { error } = await supabase.from('products').update(patch).eq('id', id);
    if (error) setMsg(error.message);
  }

  async function updateSeller(patch: Partial<Seller>) {
    if (!sellerId) return;
    setMsg(null);
    const { error } = await supabase.from('sellers').update(patch).eq('id', sellerId);
    if (error) setMsg(error.message);
    else setMsg('__success__Configuracoes atualizadas');
  }

  async function uploadSellerLogo(file: File) {
    if (!sellerId) return;
    setMsg(null);
    setUploadingLogo(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `${sellerId}/logo-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase
        .storage
        .from('seller-logos')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from('seller-logos').getPublicUrl(path);
      const publicUrl = data?.publicUrl ?? null;

      if (!publicUrl) throw new Error('Nao foi possivel obter URL publica do logo.');

      setSeller((s) => s ? ({ ...s, logo_url: publicUrl }) : s);
      await updateSeller({ logo_url: publicUrl });
    } catch (e: any) {
      setMsg(e?.message ?? 'Erro ao enviar logo');
    } finally {
      setUploadingLogo(false);
    }
  }

  async function openStripeOnboarding() {
    if (!sellerId) return;
    setMsg(null);

    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!apiBase) {
      setMsg('Faltou NEXT_PUBLIC_API_BASE_URL no ambiente do portal.');
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setMsg('Sessao expirada. Faca login novamente.');
      return;
    }

    const resp = await fetch(`${apiBase}/sellers/stripe/onboarding-link`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ sellerId }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      setMsg(`Erro ao gerar link do Stripe: ${err.error ?? resp.status}`);
      return;
    }

    const data = await resp.json();
    if (data?.url) {
      window.location.href = data.url;
      setMsg('__success__Abrindo o onboarding do Stripe...');
    } else {
      setMsg('Resposta inesperada do servidor ao gerar onboarding.');
    }
  }

  const isSuccess = msg?.startsWith('__success__');
  const displayMsg = isSuccess ? msg?.replace('__success__', '') : msg;

  if (loading) {
    return (
      <div className="container">
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-brand)' }}>LotePro</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Header */}
      <div className="card" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0', fontSize: 14 }}>
            {seller ? (
              <>Fornecedor: <strong>{seller.display_name}</strong> &middot; Produtos ativos: <strong>{activeCount}</strong></>
            ) : '\u2014'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => (window.location.href = '/dashboard/products/new')}>+ Novo produto</button>
          <button className="btn secondary" onClick={() => (window.location.href = '/dashboard/orders')}>Pedidos</button>
          <button className="btn ghost" onClick={logout}>Sair</button>
        </div>
      </div>

      {displayMsg && (
        <div className={isSuccess ? 'msg-success' : 'msg-error'} style={{ marginBottom: 16 }}>
          {displayMsg}
        </div>
      )}

      {/* Seller Config */}
      {seller && (
        <div className="card card-accent" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 20px' }}>Configuracoes do fornecedor</h2>

          <div className="row" style={{ marginBottom: 16 }}>
            <div>
              <label className="label">E-mail de pedidos</label>
              <input
                className="input"
                value={seller.order_email}
                onChange={(e) => setSeller({ ...seller, order_email: e.target.value })}
              />
            </div>

            <div>
              <label className="label">Logo do fornecedor</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  className="input"
                  value={seller.logo_url ?? ''}
                  onChange={(e) => setSeller({ ...seller, logo_url: e.target.value })}
                  placeholder="https://.../logo.png"
                  style={{ flex: 1 }}
                />
                <label className="btn secondary sm" style={{ cursor: 'pointer', flexShrink: 0 }}>
                  {uploadingLogo ? 'Enviando...' : 'Upload'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadSellerLogo(f);
                    }}
                  />
                </label>
              </div>
              <p style={{ color: 'var(--text-tertiary)', fontSize: 12, marginTop: 4 }}>PNG/JPEG ate 2MB.</p>
            </div>

            <div>
              <label className="label">Horario limite (cut-off) D+1</label>
              <input
                className="input"
                value={seller.cutoff_time}
                onChange={(e) => setSeller({ ...seller, cutoff_time: e.target.value })}
                placeholder="18:00"
              />
            </div>
          </div>

          <div className="row" style={{ marginBottom: 16 }}>
            <div>
              <label className="label">Frete fixo (R$)</label>
              <input
                className="input"
                type="number"
                step="0.01"
                value={(seller.shipping_fee_cents / 100).toFixed(2)}
                onChange={(e) => setSeller({ ...seller, shipping_fee_cents: brlToCents(e.target.value) })}
              />
            </div>

            <div>
              <label className="label">Pedido minimo (R$)</label>
              <input
                className="input"
                type="number"
                step="0.01"
                value={(seller.min_order_cents / 100).toFixed(2)}
                onChange={(e) => setSeller({ ...seller, min_order_cents: brlToCents(e.target.value) })}
              />
            </div>

            <div>
              <label className="label">B2C habilitado</label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14, fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={!!seller.b2c_enabled}
                  onChange={(e) => setSeller({ ...seller, b2c_enabled: e.target.checked })}
                />
                Permitir pedidos de CPF (entrega B2C)
              </label>
            </div>
          </div>

          {/* Delivery days */}
          <div style={{ marginBottom: 16 }}>
            <label className="label">Dias de entrega</label>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
              {DAY_OPTIONS.map((d) => (
                <label key={d.value} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={(seller.delivery_days ?? [1, 2, 3, 4, 5]).includes(d.value)}
                    onChange={(e) => {
                      const current = seller.delivery_days ?? [1, 2, 3, 4, 5];
                      const next = e.target.checked
                        ? Array.from(new Set([...current, d.value])).sort((a, b) => a - b)
                        : current.filter((v) => v !== d.value);
                      setSeller({ ...seller, delivery_days: next });
                    }}
                  />
                  {d.label}
                </label>
              ))}
            </div>
            <p style={{ color: 'var(--text-tertiary)', fontSize: 12, marginTop: 6 }}>
              Regra: sabado entrega terca; domingo entrega segunda. Demais dias seguem cut-off.
            </p>
          </div>

          {/* Stripe */}
          <div style={{ marginBottom: 20 }}>
            <label className="label">Recebimentos (Stripe)</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              <span className={`badge ${seller.stripe_account_id ? 'success' : 'neutral'}`}>
                {seller.stripe_account_id ? 'Conta conectada' : 'Nao configurado'}
              </span>
              <span className={`badge ${seller.stripe_account_charges_enabled ? 'success' : 'neutral'}`}>
                {seller.stripe_account_charges_enabled ? 'Charges OK' : 'Charges pendente'}
              </span>
              <span className={`badge ${seller.stripe_account_payouts_enabled ? 'success' : 'neutral'}`}>
                {seller.stripe_account_payouts_enabled ? 'Payouts OK' : 'Payouts pendente'}
              </span>
            </div>
            <button className="btn secondary sm" onClick={openStripeOnboarding} style={{ marginTop: 12 }}>
              Configurar recebimentos (Stripe Connect)
            </button>
            <p style={{ color: 'var(--text-tertiary)', fontSize: 12, marginTop: 8 }}>
              * O pedido so pode ser pago quando o fornecedor estiver pronto para receber (conta Stripe conectada).
            </p>
          </div>

          <button
            className="btn"
            style={{ width: '100%' }}
            onClick={() => updateSeller({
              order_email: seller.order_email,
              logo_url: seller.logo_url ?? null,
              cutoff_time: seller.cutoff_time,
              shipping_fee_cents: seller.shipping_fee_cents,
              min_order_cents: seller.min_order_cents,
              b2c_enabled: seller.b2c_enabled,
              delivery_days: seller.delivery_days ?? [1, 2, 3, 4, 5],
            })}
          >
            Salvar configuracoes
          </button>
        </div>
      )}

      {/* Products */}
      <div className="card">
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 16px' }}>Produtos</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Tipo</th>
                <th>Validade minima</th>
                <th>Preco base</th>
                <th>Status</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td data-label="Produto">
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: 12, marginTop: 2 }}>
                      {p.unit} &middot; {p.pricing_mode === 'per_kg_box' ? 'por caixa (peso variavel)' : 'por unidade'} &middot; {new Date(p.updated_at).toLocaleString('pt-BR')}
                    </div>
                  </td>
                  <td data-label="Tipo">
                    <span className={`badge ${p.fresh ? 'fresh' : 'frozen'}`}>{p.fresh ? 'Fresco' : 'Congelado'}</span>
                    <div style={{ marginTop: 8 }}>
                      <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={p.fresh}
                          onChange={(e) => updateProduct(p.id, { fresh: e.target.checked })}
                        />
                        Fresco
                      </label>
                    </div>
                  </td>
                  <td data-label="Validade minima">
                    <input
                      className="input"
                      style={{ maxWidth: 160 }}
                      type="date"
                      value={p.min_expiry_date ?? ''}
                      onChange={(e) => updateProduct(p.id, { min_expiry_date: e.target.value || null })}
                    />
                  </td>
                  <td data-label="Preco base">
                    <input
                      className="input"
                      style={{ maxWidth: 140 }}
                      type="number"
                      step="0.01"
                      value={(p.base_price_cents / 100).toFixed(2)}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v)) updateProduct(p.id, { base_price_cents: Math.round(v * 100) });
                      }}
                    />
                    <div style={{ color: 'var(--text-tertiary)', fontSize: 12, marginTop: 4 }}>
                      {centsToBRL(p.base_price_cents)} / {p.pricing_mode === 'per_kg_box' ? 'kg' : p.unit}
                      {p.pricing_mode === 'per_kg_box' && p.estimated_box_weight_kg ? ` \u2022 ~${p.estimated_box_weight_kg}kg/cx` : ''}
                    </div>
                  </td>
                  <td data-label="Status">
                    <span className={`badge ${p.active ? 'success' : 'neutral'}`}>{p.active ? 'Ativo' : 'Pausado'}</span>
                  </td>
                  <td data-label="Acoes">
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="btn secondary sm" onClick={() => updateProduct(p.id, { active: !p.active })}>
                        {p.active ? 'Pausar' : 'Reativar'}
                      </button>
                      <button className="btn ghost sm" onClick={() => (window.location.href = `/dashboard/products/${p.id}`)}>
                        Variantes
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!products.length && (
                <tr>
                  <td colSpan={6} style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 32 }}>
                    Nenhum produto cadastrado. Clique em "+ Novo produto" para comecar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
