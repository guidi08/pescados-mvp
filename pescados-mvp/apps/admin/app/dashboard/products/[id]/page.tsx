'use client';

import { useEffect, useMemo, useState } from 'react';
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
    const session = sessionData.session;
    if (!session) {
      window.location.href = '/login';
      return;
    }

    const { data: p, error: pErr } = await supabase.from('products').select('*').eq('id', productId).single();
    if (pErr) {
      setMsg(pErr.message);
      setLoading(false);
      return;
    }

    const { data: vs } = await supabase.from('product_variants').select('*').eq('product_id', productId).order('created_at', { ascending: false });
    setProduct(p);
    setVariants(vs ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const isVariableWeight = product?.pricing_mode === 'per_kg_box';

  async function updateProduct(patch: any) {
    setMsg(null);
    const { error } = await supabase.from('products').update(patch).eq('id', productId);
    if (error) setMsg(error.message);
    else {
      setMsg('Produto atualizado ✅');
      await load();
    }
  }

  async function createVariant() {
    setMsg(null);
    const priceCents = brlToCents(newVarPrice);
    if (!newVarName.trim()) {
      setMsg('Informe o nome do calibre/variante.');
      return;
    }
    if (!priceCents || priceCents <= 0) {
      setMsg('Informe um preço válido.');
      return;
    }
    const { error } = await supabase.from('product_variants').insert({
      product_id: productId,
      name: newVarName.trim(),
      price_cents: priceCents,
      min_expiry_date: newVarExpiry.trim() ? newVarExpiry.trim() : null,
      active: true,
    });
    if (error) setMsg(error.message);
    else {
      setNewVarName('');
      setNewVarPrice('0');
      setNewVarExpiry('');
      await load();
    }
  }

  async function updateVariant(variantId: string, patch: any) {
    setMsg(null);
    const { error } = await supabase.from('product_variants').update(patch).eq('id', variantId);
    if (error) setMsg(error.message);
    else await load();
  }

  if (loading) {
    return (
      <div className="container">
        <div className="card">Carregando...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container">
        <div className="card">Produto não encontrado.</div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="row inline" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <h2>{product.name}</h2>
        <a className="btn secondary" href="/dashboard">Voltar</a>
      </div>

      {msg ? <div className="card" style={{ border: '1px solid #ffd2d2', color: '#a00', marginBottom: 12 }}>{msg}</div> : null}

      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Configurações</h3>
        <div className="row">
          <div>
            <label className="label">Preço base</label>
            <input
              className="input"
              defaultValue={(Number(product.base_price_cents ?? 0) / 100).toFixed(2).replace('.', ',')}
              onBlur={(e) => updateProduct({ base_price_cents: brlToCents((e.target as any).value) })}
            />
            <div style={{ color: '#666', fontSize: 12, marginTop: 6 }}>
              {isVariableWeight ? 'Preço por kg.' : `Preço por ${product.unit}.`}
            </div>
          </div>
          <div>
            <label className="label">Ativo</label>
            <select className="input" value={product.active ? '1' : '0'} onChange={(e) => updateProduct({ active: e.target.value === '1' })}>
              <option value="1">Sim</option>
              <option value="0">Não (pausado)</option>
            </select>
          </div>
          <div>
            <label className="label">Fresco</label>
            <select className="input" value={product.fresh ? '1' : '0'} onChange={(e) => updateProduct({ fresh: e.target.value === '1' })}>
              <option value="1">Sim</option>
              <option value="0">Não</option>
            </select>
          </div>
        </div>

        {isVariableWeight ? (
          <div className="row" style={{ marginTop: 12 }}>
            <div>
              <label className="label">Peso estimado por caixa (kg)</label>
              <input
                className="input"
                defaultValue={String(product.estimated_box_weight_kg ?? '')}
                onBlur={(e) => updateProduct({ estimated_box_weight_kg: Number((e.target as any).value) })}
              />
            </div>
            <div>
              <label className="label">Variação máx. (%)</label>
              <input
                className="input"
                defaultValue={String(product.max_weight_variation_pct ?? '')}
                onBlur={(e) => updateProduct({ max_weight_variation_pct: Number((e.target as any).value) })}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="card">
        <div className="row inline" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ marginTop: 0 }}>Calibres / Variantes</h3>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Preço</th>
                <th>Validade mínima</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <tr key={v.id}>
                  <td data-label="Nome">{v.name}</td>
                  <td data-label="Preço">
                    <input
                      className="input"
                      style={{ width: 140 }}
                      defaultValue={(Number(v.price_cents ?? 0) / 100).toFixed(2).replace('.', ',')}
                      onBlur={(e) => updateVariant(v.id, { price_cents: brlToCents((e.target as any).value) })}
                    />
                  </td>
                  <td data-label="Validade mínima">
                    <input
                      className="input"
                      style={{ width: 160 }}
                      defaultValue={v.min_expiry_date ?? ''}
                      onBlur={(e) => updateVariant(v.id, { min_expiry_date: (e.target as any).value || null })}
                      placeholder="YYYY-MM-DD"
                    />
                  </td>
                  <td data-label="Status">
                    <select className="input" style={{ width: 140 }} value={v.active ? '1' : '0'} onChange={(e) => updateVariant(v.id, { active: e.target.value === '1' })}>
                      <option value="1">Ativo</option>
                      <option value="0">Inativo</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 16, borderTop: '1px solid #eee', paddingTop: 16 }}>
          <h4 style={{ marginTop: 0 }}>Adicionar variante</h4>
          <div className="row">
            <div>
              <label className="label">Nome</label>
              <input className="input" value={newVarName} onChange={(e) => setNewVarName(e.target.value)} placeholder="Ex: 3-4kg" />
            </div>
            <div>
              <label className="label">Preço (R$)</label>
              <input className="input" value={newVarPrice} onChange={(e) => setNewVarPrice(e.target.value)} placeholder="Ex: 59,90" />
            </div>
            <div>
              <label className="label">Validade mínima</label>
              <input className="input" value={newVarExpiry} onChange={(e) => setNewVarExpiry(e.target.value)} placeholder="YYYY-MM-DD" />
            </div>
          </div>
          <button className="btn" onClick={createVariant} style={{ marginTop: 12 }}>Criar variante</button>
        </div>

        <div style={{ marginTop: 16, color: '#666', fontSize: 12 }}>
          Preço final no app: se existir variante selecionada, usa o preço da variante; senão usa o preço base.
        </div>
      </div>
    </div>
  );
}
