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

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');

  const [unit, setUnit] = useState('kg');
  const [pricingMode, setPricingMode] = useState<'per_unit' | 'per_kg_box'>('per_unit');

  const [estimatedBoxWeightKg, setEstimatedBoxWeightKg] = useState('30');
  const [maxVarPct, setMaxVarPct] = useState('10');

  const [fresh, setFresh] = useState(false);
  const [minExpiry, setMinExpiry] = useState<string>('');

  const [price, setPrice] = useState('0.00');

  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        window.location.href = '/login';
        return;
      }

      const userId = session.user.id;
      const { data: prof } = await supabase.from('profiles').select('seller_id').eq('id', userId).single();
      if (!prof?.seller_id) {
        setMsg('Seu usuário não está vinculado a um fornecedor (profiles.seller_id).');
        setLoading(false);
        return;
      }

      setSellerId(prof.seller_id);
      setLoading(false);
    })();
  }, []);

  async function create() {
    if (!sellerId) return;
    setMsg(null);

    if (!name.trim()) {
      setMsg('Informe o nome do produto.');
      return;
    }

    if (pricingMode === 'per_kg_box' && unit !== 'cx') {
      // convenience: when per_kg_box, we strongly recommend unit=cx
      setUnit('cx');
    }

    const payload: any = {
      seller_id: sellerId,
      name: name.trim(),
      description: description.trim() || null,
      category: category.trim() || null,
      unit: unit.trim() || 'kg',
      pricing_mode: pricingMode,
      fresh,
      min_expiry_date: minExpiry || null,
      base_price_cents: brlToCents(price),
      active: true,
      currency: 'brl',
    };

    if (pricingMode === 'per_kg_box') {
      payload.estimated_box_weight_kg = Number(estimatedBoxWeightKg.replace(',', '.')) || 30;
      payload.max_weight_variation_pct = Number(maxVarPct.replace(',', '.')) || 0;
    } else {
      payload.estimated_box_weight_kg = null;
      payload.max_weight_variation_pct = 0;
    }

    const { error } = await supabase.from('products').insert(payload);
    if (error) {
      setMsg(error.message);
      return;
    }

    window.location.href = '/dashboard';
  }

  if (loading) {
    return (
      <div className="container">
        <div className="card">
          <h1>Novo produto</h1>
          <p>Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <h1>Novo produto</h1>
        <button className="btn secondary" onClick={() => (window.location.href = '/dashboard')}>Voltar</button>
      </div>

      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="row">
          <div style={{ flex: 1 }}>
            <label className="label">Nome</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div style={{ width: 260 }}>
            <label className="label">Categoria</label>
            <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex: Salmão, Camarão..." />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label className="label">Descrição</label>
          <textarea className="input" style={{ minHeight: 90 }} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <div>
            <label className="label">Modo de precificação</label>
            <select className="input" value={pricingMode} onChange={(e) => setPricingMode(e.target.value as any)}>
              <option value="per_unit">Por unidade (kg/cx/un)</option>
              <option value="per_kg_box">Por kg, vendido por caixa (peso variável)</option>
            </select>
            <div style={{ color: '#666', fontSize: 12, marginTop: 6 }}>
              * Use <strong>per_kg_box</strong> para salmão por caixa (30kg estimado).
            </div>
          </div>

          <div>
            <label className="label">Unidade (para o pedido)</label>
            <input className="input" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kg / cx / un" />
          </div>

          <div>
            <label className="label">Fresco</label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
              <input type="checkbox" checked={fresh} onChange={(e) => setFresh(e.target.checked)} />
              Sim (produto fresco)
            </label>
          </div>
        </div>

        {pricingMode === 'per_kg_box' ? (
          <div className="row" style={{ marginTop: 12 }}>
            <div>
              <label className="label">Peso estimado (kg por caixa)</label>
              <input className="input" value={estimatedBoxWeightKg} onChange={(e) => setEstimatedBoxWeightKg(e.target.value)} />
            </div>
            <div>
              <label className="label">Variação máxima (%)</label>
              <input className="input" value={maxVarPct} onChange={(e) => setMaxVarPct(e.target.value)} />
            </div>
          </div>
        ) : null}

        <div className="row" style={{ marginTop: 12 }}>
          <div>
            <label className="label">Validade mínima (lote)</label>
            <input className="input" type="date" value={minExpiry} onChange={(e) => setMinExpiry(e.target.value)} />
          </div>

          <div>
            <label className="label">Preço</label>
            <input className="input" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            <div style={{ color: '#666', fontSize: 12, marginTop: 6 }}>
              {pricingMode === 'per_kg_box' ? 'Preço por kg (venda por caixa)' : `Preço por ${unit}`}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <button className="btn" onClick={create}>Criar produto</button>
        </div>
      </div>
    </div>
  );
}
