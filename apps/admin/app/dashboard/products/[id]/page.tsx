'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabaseClient';

type Variant = {
  id: string;
  product_id: string;
  name: string;
  price_cents: number;
  active: boolean;
  min_expiry_date: string | null;
};

function centsToBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function VariantsPage({ params }: { params: { id: string } }) {
  const productId = params.id;

  const [loading, setLoading] = useState(true);
  const [productName, setProductName] = useState<string>('—');
  const [variants, setVariants] = useState<Variant[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('0.00');
  const [newExpiry, setNewExpiry] = useState('');

  async function load() {
    setLoading(true);
    setMsg(null);

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      window.location.href = '/login';
      return;
    }

    const [{ data: p, error: pErr }, { data: v, error: vErr }] = await Promise.all([
      supabase.from('products').select('id,name').eq('id', productId).single(),
      supabase.from('product_variants').select('*').eq('product_id', productId).order('created_at', { ascending: false }),
    ]);

    if (pErr) setMsg(pErr.message);
    if (vErr) setMsg(vErr.message);

    if (p) setProductName(p.name);
    setVariants((v ?? []) as any);

    // realtime variants
    const channel = supabase
      .channel('realtime-variants')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_variants', filter: `product_id=eq.${productId}` }, () => {
        supabase.from('product_variants').select('*').eq('product_id', productId).order('created_at', { ascending: false })
          .then(({ data }) => setVariants((data ?? []) as any));
      })
      .subscribe();

    setLoading(false);

    return () => { supabase.removeChannel(channel); };
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addVariant() {
    setMsg(null);
    const price_cents = Math.round(Number(newPrice) * 100);

    const { error } = await supabase.from('product_variants').insert({
      product_id: productId,
      name: newName,
      price_cents,
      active: true,
      min_expiry_date: newExpiry || null,
    });

    if (error) setMsg(error.message);
    else {
      setNewName('');
      setNewPrice('0.00');
      setNewExpiry('');
    }
  }

  async function updateVariant(id: string, patch: Partial<Variant>) {
    setMsg(null);
    const { error } = await supabase.from('product_variants').update(patch).eq('id', id);
    if (error) setMsg(error.message);
  }

  if (loading) {
    return (
      <div className="container">
        <div className="card">
          <h1>Variantes</h1>
          <p>Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card">
        <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1>Variantes (calibre) — {productName}</h1>
            <p style={{ color: '#666' }}>Use variantes para tamanhos/calibres diferentes (ex.: 2-3kg, 3-4kg...).</p>
          </div>
          <div>
            <button className="btn secondary" onClick={() => (window.location.href = '/dashboard')}>Voltar</button>
          </div>
        </div>

        {msg && <p style={{ marginTop: 12 }}>{msg}</p>}

        <h2 style={{ marginTop: 16 }}>Adicionar variante</h2>
        <div className="row">
          <div>
            <label className="label">Nome</label>
            <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: 3-4kg" />
          </div>
          <div>
            <label className="label">Preço (R$)</label>
            <input className="input" type="number" step="0.01" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
          </div>
          <div>
            <label className="label">Validade mínima</label>
            <input className="input" type="date" value={newExpiry} onChange={(e) => setNewExpiry(e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <button className="btn" onClick={addVariant} disabled={!newName || Number(newPrice) <= 0}>Adicionar</button>
        </div>

        <h2 style={{ marginTop: 24 }}>Lista</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Variante</th>
              <th>Validade mínima</th>
              <th>Preço</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v) => (
              <tr key={v.id}>
                <td><strong>{v.name}</strong></td>
                <td>
                  <input
                    className="input"
                    style={{ maxWidth: 160 }}
                    type="date"
                    value={v.min_expiry_date ?? ''}
                    onChange={(e) => updateVariant(v.id, { min_expiry_date: e.target.value || null })}
                  />
                </td>
                <td>
                  <input
                    className="input"
                    style={{ maxWidth: 140 }}
                    type="number"
                    step="0.01"
                    value={(v.price_cents / 100).toFixed(2)}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (Number.isFinite(val)) updateVariant(v.id, { price_cents: Math.round(val * 100) });
                    }}
                  />
                  <div style={{ color: '#666', fontSize: 12 }}>{centsToBRL(v.price_cents)}</div>
                </td>
                <td>
                  <span className={`badge ${v.active ? 'green' : 'gray'}`}>{v.active ? 'Ativo' : 'Pausado'}</span>
                </td>
                <td>
                  <button className="btn secondary" onClick={() => updateVariant(v.id, { active: !v.active })}>
                    {v.active ? 'Pausar' : 'Reativar'}
                  </button>
                </td>
              </tr>
            ))}
            {!variants.length && (
              <tr>
                <td colSpan={5} style={{ color: '#666' }}>Nenhuma variante cadastrada (produto usa preço base).</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
