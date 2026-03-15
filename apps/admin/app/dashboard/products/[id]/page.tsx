'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabaseClient';

function centsToBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function brlToCents(input: string): number {
  const n = Number(String(input).replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export default function ProductDetailPage({ params }: any) {
  const productId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [product, setProduct] = useState<any | null>(null);
  const [variants, setVariants] = useState<any[]>([]);

  const [newVarName, setNewVarName] = useState('');
  const [newVarPrice, setNewVarPrice] = useState('0');
  const [newVarExpiry, setNewVarExpiry] = useState('');

  async function load() {
    setLoading(true);
    setMsg(null);

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { window.location.href = '/login'; return; }

    const { data: p, error: pErr } = await supabase.from('products').select('*').eq('id', productId).single();
    if (pErr) { setMsg(pErr.message); setLoading(false); return; }

    const { data: vs } = await supabase.from('product_variants').select('*').eq('product_id', productId).order('created_at', { ascending: false });
    setProduct(p);
    setVariants(vs ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [productId]);

  const isVariableWeight = product?.pricing_mode === 'per_kg_box';

  async function triggerAi(pid: string) {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!apiBase) return false;
    const { data: sd } = await supabase.auth.getSession();
    const token = sd.session?.access_token;
    if (!token) return false;
    const resp = await fetch(`${apiBase}/ai/classify-product`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'authorization': `Bearer ${token}` },
      body: JSON.stringify({ productId: pid }),
    });
    return resp.ok;
  }

  async function updateProduct(patch: any) {
    setMsg(null);
    const { error } = await supabase.from('products').update(patch).eq('id', productId);
    if (error) { setMsg(error.message); return; }
    const shouldClassify = ['name', 'description', 'unit', 'fresh', 'pricing_mode'].some((k) => k in patch);
    if (shouldClassify) await triggerAi(productId);
    setMsg('__success__Produto atualizado');
    await load();
  }

  async function createVariant() {
    setMsg(null);
    const priceCents = brlToCents(newVarPrice);
    if (!newVarName.trim()) { setMsg('Informe o nome do calibre/variante.'); return; }
    if (!priceCents || priceCents <= 0) { setMsg('Informe um preco valido.'); return; }
    const { error } = await supabase.from('product_variants').insert({
      product_id: productId,
      name: newVarName.trim(),
      price_cents: priceCents,
      min_expiry_date: newVarExpiry.trim() || null,
      active: true,
    });
    if (error) { setMsg(error.message); return; }
    setNewVarName(''); setNewVarPrice('0'); setNewVarExpiry('');
    await load();
  }

  async function updateVariant(variantId: string, patch: any) {
    setMsg(null);
    const { error } = await supabase.from('product_variants').update(patch).eq('id', variantId);
    if (error) setMsg(error.message);
    else await load();
  }

  const isSuccess = msg?.startsWith('__success__');
  const displayMsg = isSuccess ? msg?.replace('__success__', '') : msg;

  if (loading) {
    return (
      <div className="container">
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <p style={{ color: 'var(--text-secondary)' }}>Carregando...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container">
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <p style={{ color: 'var(--text-secondary)' }}>Produto nao encontrado.</p>
          <a className="btn ghost" href="/dashboard" style={{ marginTop: 16, display: 'inline-flex' }}>&larr; Voltar</a>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>{product.name}</h2>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 13, margin: '4px 0 0' }}>
            {product.unit} &middot; {isVariableWeight ? 'peso variavel' : 'por unidade'} &middot; {centsToBRL(product.base_price_cents)}
          </p>
        </div>
        <a className="btn ghost sm" href="/dashboard">&larr; Voltar</a>
      </div>

      {displayMsg && (
        <div className={isSuccess ? 'msg-success' : 'msg-error'} style={{ marginBottom: 16 }}>
          {displayMsg}
        </div>
      )}

      {/* Config Card */}
      <div className="card card-accent" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 16px' }}>Configuracoes</h3>
        <div className="row" style={{ marginBottom: 16 }}>
          <div>
            <label className="label">Preco base</label>
            <input
              className="input"
              defaultValue={(Number(product.base_price_cents ?? 0) / 100).toFixed(2).replace('.', ',')}
              onBlur={(e) => updateProduct({ base_price_cents: brlToCents(e.target.value) })}
            />
            <p style={{ color: 'var(--text-tertiary)', fontSize: 12, marginTop: 4 }}>
              {isVariableWeight ? 'Preco por kg.' : `Preco por ${product.unit}.`}
            </p>
          </div>
          <div>
            <label className="label">Ativo</label>
            <select className="input" value={product.active ? '1' : '0'} onChange={(e) => updateProduct({ active: e.target.value === '1' })}>
              <option value="1">Sim</option>
              <option value="0">Nao (pausado)</option>
            </select>
          </div>
          <div>
            <label className="label">Fresco</label>
            <select className="input" value={product.fresh ? '1' : '0'} onChange={(e) => updateProduct({ fresh: e.target.value === '1' })}>
              <option value="1">Sim</option>
              <option value="0">Nao</option>
            </select>
          </div>
        </div>

        {isVariableWeight && (
          <div className="row">
            <div>
              <label className="label">Peso estimado por caixa (kg)</label>
              <input
                className="input"
                defaultValue={String(product.estimated_box_weight_kg ?? '')}
                onBlur={(e) => updateProduct({ estimated_box_weight_kg: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Variacao max. (%)</label>
              <input
                className="input"
                defaultValue={String(product.max_weight_variation_pct ?? '')}
                onBlur={(e) => updateProduct({ max_weight_variation_pct: Number(e.target.value) })}
              />
            </div>
          </div>
        )}
      </div>

      {/* Variants Card */}
      <div className="card">
        <h3 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 16px' }}>Calibres / Variantes</h3>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Preco</th>
                <th>Validade minima</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <tr key={v.id}>
                  <td data-label="Nome" style={{ fontWeight: 600 }}>{v.name}</td>
                  <td data-label="Preco">
                    <input
                      className="input"
                      style={{ maxWidth: 140 }}
                      defaultValue={(Number(v.price_cents ?? 0) / 100).toFixed(2).replace('.', ',')}
                      onBlur={(e) => updateVariant(v.id, { price_cents: brlToCents(e.target.value) })}
                    />
                  </td>
                  <td data-label="Validade minima">
                    <input
                      className="input"
                      style={{ maxWidth: 160 }}
                      type="date"
                      defaultValue={v.min_expiry_date ?? ''}
                      onBlur={(e) => updateVariant(v.id, { min_expiry_date: e.target.value || null })}
                    />
                  </td>
                  <td data-label="Status">
                    <select className="input" style={{ maxWidth: 140 }} value={v.active ? '1' : '0'} onChange={(e) => updateVariant(v.id, { active: e.target.value === '1' })}>
                      <option value="1">Ativo</option>
                      <option value="0">Inativo</option>
                    </select>
                  </td>
                </tr>
              ))}
              {!variants.length && (
                <tr>
                  <td colSpan={4} style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 24 }}>
                    Nenhuma variante cadastrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Add variant */}
        <div style={{ marginTop: 20, borderTop: '1px solid var(--border-subtle)', paddingTop: 20 }}>
          <h4 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 12px' }}>Adicionar variante</h4>
          <div className="row" style={{ marginBottom: 12 }}>
            <div>
              <label className="label">Nome</label>
              <input className="input" value={newVarName} onChange={(e) => setNewVarName(e.target.value)} placeholder="Ex: 3-4kg" />
            </div>
            <div>
              <label className="label">Preco (R$)</label>
              <input className="input" value={newVarPrice} onChange={(e) => setNewVarPrice(e.target.value)} placeholder="Ex: 59,90" />
            </div>
            <div>
              <label className="label">Validade minima</label>
              <input className="input" type="date" value={newVarExpiry} onChange={(e) => setNewVarExpiry(e.target.value)} />
            </div>
          </div>
          <button className="btn" onClick={createVariant}>Criar variante</button>
        </div>

        <p style={{ color: 'var(--text-tertiary)', fontSize: 12, marginTop: 20 }}>
          Preco final no app: se existir variante selecionada, usa o preco da variante; senao usa o preco base.
        </p>
      </div>
    </div>
  );
}
