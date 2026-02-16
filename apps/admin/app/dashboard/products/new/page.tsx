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
  const [namePreset, setNamePreset] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');

  const unit = 'cx';
  const [pricingMode, setPricingMode] = useState<'variable' | 'fixed'>('variable');

  const [estimatedBoxWeightKg, setEstimatedBoxWeightKg] = useState('30');
  const [maxVarPct, setMaxVarPct] = useState('12');

  const [fresh, setFresh] = useState(false);
  const [freshExpiryDays, setFreshExpiryDays] = useState('');
  const [frozenExpiryMonth, setFrozenExpiryMonth] = useState('');
  const [frozenExpiryDate, setFrozenExpiryDate] = useState('');

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

  function formatDate(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function computeMinExpiryDate(): string | null {
    if (fresh) {
      const days = Number(freshExpiryDays);
      if (!Number.isFinite(days) || days <= 0) return null;
      const d = new Date();
      d.setDate(d.getDate() + Math.round(days));
      return formatDate(d);
    }

    if (frozenExpiryDate) return frozenExpiryDate;

    if (!frozenExpiryMonth) return null;
    const [y, m] = frozenExpiryMonth.split('-').map(Number);
    if (!y || !m) return null;
    // last day of month
    const d = new Date(y, m, 0);
    return formatDate(d);
  }

  async function create() {
    if (!sellerId) return;
    setMsg(null);

    const finalName = (namePreset === '__custom__' ? name : namePreset).trim();

    if (!finalName) {
      setMsg('Informe o nome do produto.');
      return;
    }

    const payload: any = {
      seller_id: sellerId,
      name: finalName,
      description: description.trim() || null,
      category: category.trim() || null,
      unit,
      pricing_mode: 'per_kg_box',
      fresh,
      min_expiry_date: computeMinExpiryDate(),
      base_price_cents: brlToCents(price),
      active: true,
      currency: 'brl',
    };

    payload.estimated_box_weight_kg = Number(estimatedBoxWeightKg.replace(',', '.')) || 30;
    payload.max_weight_variation_pct = fresh
      ? 12
      : (pricingMode === 'fixed'
        ? 0
        : (Number(maxVarPct.replace(',', '.')) || 0));

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
            <select
              className="input"
              value={namePreset}
              onChange={(e) => {
                setNamePreset(e.target.value);
                if (e.target.value !== '__custom__') setName('');
              }}
            >
              <option value="">Selecione...</option>
              <option value="Salmão inteiro Fresco 6/8">Salmão inteiro Fresco 6/8</option>
              <option value="Salmão inteiro Fresco 8/10">Salmão inteiro Fresco 8/10</option>
              <option value="Salmão inteiro Fresco 10/12">Salmão inteiro Fresco 10/12</option>
              <option value="Salmão inteiro Fresco 12/14">Salmão inteiro Fresco 12/14</option>
              <option value="Salmão Inteiro Fresco 14/16">Salmão Inteiro Fresco 14/16</option>
              <option value="Salmão Inteiro Fresco 16/18">Salmão Inteiro Fresco 16/18</option>
              <option value="Salmão Inteiro Fresco 18/20">Salmão Inteiro Fresco 18/20</option>
              <option value="Salmão Inteiro Fresco 20/up">Salmão Inteiro Fresco 20/up</option>
              <option value="Filé de Saint Peter Fresco">Filé de Saint Peter Fresco</option>
              <option value="Filé de Saint Peter">Filé de Saint Peter</option>
              <option value="Filé de Salmão 800/1200">Filé de Salmão 800/1200</option>
              <option value="Filé de Salmão 1200/1500">Filé de Salmão 1200/1500</option>
              <option value="Filé de Salmão 1500/2000">Filé de Salmão 1500/2000</option>
              <option value="Filé de Salmão 2000/2500">Filé de Salmão 2000/2500</option>
              <option value="Filé de Salmão 3000 acima">Filé de Salmão 3000 acima</option>
              <option value="Centolla 1kg">Centolla 1kg</option>
              <option value="Centolla 1 a 1,2kg">Centolla 1 a 1,2kg</option>
              <option value="Centolla 1,2 a 1,4kg">Centolla 1,2 a 1,4kg</option>
              <option value="Centolla 1,4 a 1,6kg">Centolla 1,4 a 1,6kg</option>
              <option value="Centolla 1,6 a 1,8kg">Centolla 1,6 a 1,8kg</option>
              <option value="Centolla 1,8 a 2kg">Centolla 1,8 a 2kg</option>
              <option value="Centolla 2 a 2,2kg">Centolla 2 a 2,2kg</option>
              <option value="Centolla 2,2 a 2,4kg">Centolla 2,2 a 2,4kg</option>
              <option value="Centolla 2,4kg acima">Centolla 2,4kg acima</option>
              <option value="Polvo 500g abaixo">Polvo 500g abaixo</option>
              <option value="Polvo 500g a 1kg">Polvo 500g a 1kg</option>
              <option value="Polvo 1 a 1,5kg">Polvo 1 a 1,5kg</option>
              <option value="Polvo 1.5 a 2kg">Polvo 1.5 a 2kg</option>
              <option value="Polvo 2 a 2,5kg">Polvo 2 a 2,5kg</option>
              <option value="Polvo 2,5 a 3kg">Polvo 2,5 a 3kg</option>
              <option value="__custom__">Outro (digitar)</option>
            </select>
            {namePreset === '__custom__' && (
              <input
                className="input"
                style={{ marginTop: 8 }}
                placeholder="Digite o nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            )}
          </div>

          <div style={{ width: 260 }}>
            <label className="label">Categoria</label>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Selecione...</option>
              <option value="Pescados">Pescados</option>
              <option value="Frutos do Mar">Frutos do Mar</option>
              <option value="Iguarias">Iguarias</option>
            </select>
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
              <option value="variable">Por kg, vendido por caixa de peso variável</option>
              <option value="fixed">Por kg com caixa de peso fixo</option>
            </select>
          </div>

          <div>
            <label className="label">Unidade (para o pedido)</label>
            <input className="input" value={unit} disabled />
          </div>

          <div>
            <label className="label">Fresco</label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
              <input type="checkbox" checked={fresh} onChange={(e) => {
                setFresh(e.target.checked);
                setFreshExpiryDays('');
                setFrozenExpiryMonth('');
                setFrozenExpiryDate('');
              }} />
              Sim (produto fresco)
            </label>
            {fresh && (
              <div style={{ color: '#666', fontSize: 12, marginTop: 6 }}>
                Produtos frescos: variação de caixa fixada entre 10–12% (ajustamos manualmente se o tamanho for muito grande).
              </div>
            )}
          </div>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <div>
            <label className="label">Peso estimado (kg por caixa)</label>
            <input className="input" value={estimatedBoxWeightKg} onChange={(e) => setEstimatedBoxWeightKg(e.target.value)} />
          </div>
          {pricingMode === 'variable' && !fresh && (
            <div>
              <label className="label">Variação máxima (%)</label>
              <input className="input" value={maxVarPct} onChange={(e) => setMaxVarPct(e.target.value)} />
            </div>
          )}
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <div>
            <label className="label">Validade mínima</label>
            {fresh ? (
              <input
                className="input"
                type="number"
                min="1"
                placeholder="Dias"
                value={freshExpiryDays}
                onChange={(e) => setFreshExpiryDays(e.target.value)}
              />
            ) : (
              <>
                <input
                  className="input"
                  type="month"
                  value={frozenExpiryMonth}
                  onChange={(e) => setFrozenExpiryMonth(e.target.value)}
                />
                <input
                  className="input"
                  type="date"
                  style={{ marginTop: 8 }}
                  value={frozenExpiryDate}
                  onChange={(e) => setFrozenExpiryDate(e.target.value)}
                  placeholder="Data completa (opcional)"
                />
              </>
            )}
            <div style={{ color: '#666', fontSize: 12, marginTop: 6 }}>
              {fresh ? 'Informe quantidade de dias (opcional)' : 'Selecione mês/ano ou data completa (opcional)'}
            </div>
          </div>

          <div>
            <label className="label">Preço</label>
            <input className="input" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            <div style={{ color: '#666', fontSize: 12, marginTop: 6 }}>
              Preço por kg (venda por caixa)
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
