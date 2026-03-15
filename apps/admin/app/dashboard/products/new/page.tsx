'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabaseClient';

function brlToCents(input: string): number {
  const n = Number(String(input).replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export default function NewProductPage() {
  const [loading, setLoading] = useState(true);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('kg');
  const [pricingMode, setPricingMode] = useState<'per_unit' | 'per_kg_box'>('per_unit');
  const [estimatedBoxWeightKg, setEstimatedBoxWeightKg] = useState('30');
  const [maxVarPct, setMaxVarPct] = useState('10');
  const [fresh, setFresh] = useState(false);
  const [minExpiry, setMinExpiry] = useState('');
  const [tags, setTags] = useState('');
  const [price, setPrice] = useState('0');
  const [active, setActive] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        window.location.href = '/login';
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('seller_id, role')
        .eq('id', session.user.id)
        .single();

      if (!profile?.seller_id) {
        setMsg('Seu usuario nao esta vinculado a um fornecedor (seller_id).');
        setLoading(false);
        return;
      }

      setSellerId(profile.seller_id);
      setLoading(false);
    })();
  }, []);

  async function triggerAi(productId: string) {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!apiBase) return false;

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return false;

    const resp = await fetch(`${apiBase}/ai/classify-product`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'authorization': `Bearer ${token}` },
      body: JSON.stringify({ productId }),
    });

    return resp.ok;
  }

  async function createProduct() {
    if (!sellerId) return;
    setMsg(null);

    const basePriceCents = brlToCents(price);
    if (!name.trim()) { setMsg('Informe o nome do produto.'); return; }
    if (!basePriceCents || basePriceCents <= 0) { setMsg('Informe um preco valido.'); return; }

    const insert: any = {
      seller_id: sellerId,
      name: name.trim(),
      description: description.trim() || null,
      category: category.trim() || null,
      unit: unit.trim() || 'un',
      pricing_mode: pricingMode,
      estimated_box_weight_kg: pricingMode === 'per_kg_box' ? Number(estimatedBoxWeightKg) : 0,
      max_weight_variation_pct: pricingMode === 'per_kg_box' ? Number(maxVarPct) : 0,
      fresh,
      tags: tags.trim() ? tags.split(',').map((t) => t.trim()).filter(Boolean) : null,
      min_expiry_date: minExpiry.trim() || null,
      base_price_cents: basePriceCents,
      active,
    };

    const { data, error } = await supabase.from('products').insert(insert).select('id').single();
    if (error) { setMsg(error.message); return; }

    await triggerAi(data.id);
    window.location.href = `/dashboard/products/${data.id}`;
  }

  if (loading) {
    return (
      <div className="container">
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <p style={{ color: 'var(--text-secondary)' }}>Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Novo produto</h2>
        <a className="btn ghost sm" href="/dashboard">&larr; Voltar</a>
      </div>

      {msg && <div className="msg-error" style={{ marginBottom: 16 }}>{msg}</div>}

      <div className="card card-accent">
        <div className="row" style={{ marginBottom: 16 }}>
          <div>
            <label className="label">Nome</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Salmao fresco" />
          </div>
          <div>
            <label className="label">Categoria</label>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Selecione...</option>
              <option value="Peixes">Peixes</option>
              <option value="Salmao">Salmao</option>
              <option value="Camarao">Camarao</option>
              <option value="Crustaceos">Crustaceos</option>
              <option value="Mariscos">Mariscos</option>
              <option value="Outros">Outros</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label className="label">Descricao</label>
          <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalhes sobre o produto..." />
        </div>

        <div className="row" style={{ marginBottom: 16 }}>
          <div>
            <label className="label">Preco base (R$)</label>
            <input className="input" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Ex: 59,90" />
            <p style={{ color: 'var(--text-tertiary)', fontSize: 12, marginTop: 4 }}>
              Para "caixa com peso variavel", este e o preco por kg.
            </p>
          </div>
          <div>
            <label className="label">Unidade</label>
            <input className="input" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kg / cx / un" />
          </div>
          <div>
            <label className="label">Modo de preco</label>
            <select className="input" value={pricingMode} onChange={(e) => setPricingMode(e.target.value as any)}>
              <option value="per_unit">Por unidade (kg/un/cx)</option>
              <option value="per_kg_box">Por kg, vendido por caixa (peso variavel)</option>
            </select>
          </div>
        </div>

        {pricingMode === 'per_kg_box' && (
          <div className="row" style={{ marginBottom: 16 }}>
            <div>
              <label className="label">Peso estimado por caixa (kg)</label>
              <input className="input" value={estimatedBoxWeightKg} onChange={(e) => setEstimatedBoxWeightKg(e.target.value)} />
            </div>
            <div>
              <label className="label">Variacao max. (%)</label>
              <input className="input" value={maxVarPct} onChange={(e) => setMaxVarPct(e.target.value)} />
            </div>
          </div>
        )}

        <div className="row" style={{ marginBottom: 16 }}>
          <div>
            <label className="label">Tags (separadas por virgula)</label>
            <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Ex: Fresco, Sushi grade" />
          </div>
          <div>
            <label className="label">Validade minima</label>
            <input className="input" type="date" value={minExpiry} onChange={(e) => setMinExpiry(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={fresh} onChange={(e) => setFresh(e.target.checked)} />
            Fresco
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Ativo
          </label>
        </div>

        <button className="btn" onClick={createProduct} style={{ width: '100%' }}>Criar produto</button>
      </div>
    </div>
  );
}
