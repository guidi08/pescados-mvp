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
        setMsg('Seu usuário não está vinculado a um fornecedor (seller_id).');
        setLoading(false);
        return;
      }

      setSellerId(profile.seller_id);
      setLoading(false);
    })();
  }, []);


  async function triggerAi(productId: string) {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!apiBase) {
      console.warn('Faltou NEXT_PUBLIC_API_BASE_URL no ambiente do portal.');
      return false;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      console.warn('Sessão expirada.');
      return false;
    }

    const resp = await fetch(`${apiBase}/ai/classify-product`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ productId }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      console.warn('AI classify failed', err);
      return false;
    }

    return true;
  }

  async function createProduct() {
    if (!sellerId) return;
    setMsg(null);

    const basePriceCents = brlToCents(price);
    if (!name.trim()) {
      setMsg('Informe o nome do produto.');
      return;
    }
    if (!basePriceCents || basePriceCents <= 0) {
      setMsg('Informe um preço válido.');
      return;
    }

    const insert: any = {
      seller_id: sellerId,
      name: name.trim(),
      description: description.trim() ? description.trim() : null,
      category: category.trim() ? category.trim() : null,
      unit: unit.trim() || 'un',
      pricing_mode: pricingMode,
      estimated_box_weight_kg: pricingMode === 'per_kg_box' ? Number(estimatedBoxWeightKg) : null,
      max_weight_variation_pct: pricingMode === 'per_kg_box' ? Number(maxVarPct) : null,
      fresh,
      tags: tags.trim() ? tags.split(',').map((t) => t.trim()).filter(Boolean) : null,
      min_expiry_date: minExpiry.trim() ? minExpiry.trim() : null,
      base_price_cents: basePriceCents,
      active,
    };

    const { data, error } = await supabase
      .from('products')
      .insert(insert)
      .select('id')
      .single();

    if (error) {
      setMsg(error.message);
      return;
    }

    await triggerAi(data.id);
    window.location.href = `/dashboard/products/${data.id}`;
  }

  if (loading) {
    return (
      <div className="container">
        <div className="card">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="row inline" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <h2>Novo produto</h2>
        <a className="btn secondary" href="/dashboard">Voltar</a>
      </div>

      {msg ? <div className="card" style={{ border: '1px solid #ffd2d2', color: '#a00', marginBottom: 12 }}>{msg}</div> : null}

      <div className="card">
        <div className="row">
          <div>
            <label className="label">Nome</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Salmão fresco" />
          </div>
          <div>
            <label className="label">Categoria</label>
            <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex: Salmão" />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label className="label">Descrição</label>
          <textarea className="input" style={{ minHeight: 90 }} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <div>
            <label className="label">Preço base (R$)</label>
            <input className="input" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Ex: 59,90" />
            <div style={{ color: '#666', fontSize: 12, marginTop: 6 }}>
              Para “caixa com peso variável”, este é o preço por kg.
            </div>
          </div>
          <div>
            <label className="label">Unidade</label>
            <input className="input" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kg / cx / un" />
          </div>
          <div>
            <label className="label">Modo de preço</label>
            <select className="input" value={pricingMode} onChange={(e) => setPricingMode(e.target.value as any)}>
              <option value="per_unit">Por unidade (kg/un/cx)</option>
              <option value="per_kg_box">Por kg, vendido por caixa (peso variável)</option>
            </select>
          </div>
        </div>

        {pricingMode === 'per_kg_box' ? (
          <div className="row" style={{ marginTop: 12 }}>
            <div>
              <label className="label">Peso estimado por caixa (kg)</label>
              <input className="input" value={estimatedBoxWeightKg} onChange={(e) => setEstimatedBoxWeightKg(e.target.value)} />
            </div>
            <div>
              <label className="label">Variação máx. (%)</label>
              <input className="input" value={maxVarPct} onChange={(e) => setMaxVarPct(e.target.value)} />
            </div>
          </div>
        ) : null}

        <div className="row" style={{ marginTop: 12 }}>
          <div>
            <label className="label">Tags (separadas por vírgula)</label>
            <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Ex: Fresco, Sushi grade" />
          </div>
          <div>
            <label className="label">Validade mínima (YYYY-MM-DD)</label>
            <input className="input" value={minExpiry} onChange={(e) => setMinExpiry(e.target.value)} placeholder="2026-02-20" />
          </div>
        </div>

        <div className="row inline" style={{ marginTop: 12, gap: 16 }}>
          <label className="row inline" style={{ gap: 8 }}>
            <input type="checkbox" checked={fresh} onChange={(e) => setFresh(e.target.checked)} />
            Fresco
          </label>
          <label className="row inline" style={{ gap: 8 }}>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Ativo
          </label>
        </div>

        <div style={{ marginTop: 12 }}>
          <button className="btn" onClick={createProduct}>Criar</button>
        </div>
      </div>
    </div>
  );
}
