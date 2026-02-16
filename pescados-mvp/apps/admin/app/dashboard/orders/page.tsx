'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

function centsToBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function OrdersPage() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [orders, setOrders] = useState<any[]>([]);

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [weightsDraft, setWeightsDraft] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    setMsg(null);

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

    const { data, error } = await supabase
      .from('orders')
      .select('id, created_at, buyer_channel, status, payment_status, delivery_date, total_cents, contains_fresh')
      .eq('seller_id', profile.seller_id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) setMsg(error.message);
    setOrders(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function openOrder(orderId: string) {
    setSelectedOrderId(orderId);
    setSelectedOrder(null);
    setSelectedItems([]);
    setWeightsDraft({});
    setMsg(null);

    const [{ data: order }, { data: items }] = await Promise.all([
      supabase.from('orders').select('*').eq('id', orderId).single(),
      supabase.from('order_items').select('*').eq('order_id', orderId).order('created_at', { ascending: true }),
    ]);

    setSelectedOrder(order);
    setSelectedItems(items ?? []);

    const initial: Record<string, string> = {};
    (items ?? []).forEach((it: any) => {
      if (it.pricing_mode_snapshot === 'per_kg_box') {
        initial[it.id] = it.actual_total_weight_kg ? String(it.actual_total_weight_kg) : String(it.estimated_total_weight_kg_snapshot ?? '');
      }
    });
    setWeightsDraft(initial);
  }

  async function submitWeights() {
    if (!selectedOrderId) return;
    setMsg(null);

    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!apiBase) {
      setMsg('Faltou NEXT_PUBLIC_API_BASE_URL no ambiente do portal.');
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setMsg('Sessão expirada. Faça login novamente.');
      return;
    }

    const payloadItems = selectedItems
      .filter((it) => it.pricing_mode_snapshot === 'per_kg_box')
      .map((it) => ({
        orderItemId: it.id,
        actualTotalWeightKg: Number(String(weightsDraft[it.id] ?? '').replace(',', '.')),
      }))
      .filter((x) => Number.isFinite(x.actualTotalWeightKg) && x.actualTotalWeightKg > 0);

    if (!payloadItems.length) {
      setMsg('Nenhum item com peso variável para atualizar.');
      return;
    }

    const resp = await fetch(`${apiBase}/orders/${selectedOrderId}/weights`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ items: payloadItems }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      setMsg(`Erro ao atualizar pesos: ${err.error ?? resp.status}`);
      return;
    }

    const ok = await resp.json().catch(() => ({}));
    setMsg(`Pesos atualizados ✅ (delta: ${centsToBRL(ok.deltaCents ?? 0)})`);
    await openOrder(selectedOrderId);
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
        <h2>Pedidos</h2>
        <a className="btn secondary" href="/dashboard">Voltar</a>
      </div>

      {msg ? <div className="card" style={{ border: '1px solid #ffd2d2', color: msg.includes('✅') ? '#0a0' : '#a00', marginBottom: 12 }}>{msg}</div> : null}

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Data</th>
                <th>Entrega</th>
                <th>Canal</th>
                <th>Status</th>
                <th>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td data-label="ID" style={{ fontFamily: 'monospace', fontSize: 12 }}>{o.id.slice(0, 8)}…</td>
                  <td data-label="Data">{new Date(o.created_at).toLocaleString('pt-BR')}</td>
                  <td data-label="Entrega">{o.delivery_date}</td>
                  <td data-label="Canal">{o.buyer_channel?.toUpperCase()}</td>
                  <td data-label="Status">
                    <span className={`badge ${o.payment_status === 'succeeded' ? 'green' : 'gray'}`}>{o.status} / {o.payment_status}</span>
                    {o.contains_fresh ? <span className="badge" style={{ marginLeft: 8 }}>Fresco</span> : null}
                  </td>
                  <td data-label="Total">{centsToBRL(o.total_cents)}</td>
                  <td data-label="Ações">
                    <button className="btn secondary" onClick={() => openOrder(o.id)}>Detalhes</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedOrderId && selectedOrder ? (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Pedido {selectedOrderId}</h3>
          <div style={{ color: '#666', fontSize: 12, marginBottom: 12 }}>
            Atualize pesos apenas para itens “por caixa com peso variável”. Isso gera ajuste automático no saldo do cliente (B2B).
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Modo</th>
                  <th>Qtd</th>
                  <th>Estimado (kg)</th>
                  <th>Peso real (kg)</th>
                </tr>
              </thead>
              <tbody>
                {selectedItems.map((it) => (
                  <tr key={it.id}>
                    <td data-label="Item">{it.product_name_snapshot} {it.variant_name_snapshot ? `(${it.variant_name_snapshot})` : ''}</td>
                    <td data-label="Modo">{it.pricing_mode_snapshot}</td>
                    <td data-label="Qtd">{it.quantity}</td>
                    <td data-label="Estimado">{it.estimated_total_weight_kg_snapshot ?? '—'}</td>
                    <td data-label="Peso real">
                      {it.pricing_mode_snapshot === 'per_kg_box' ? (
                        <input
                          className="input"
                          style={{ width: 140 }}
                          value={weightsDraft[it.id] ?? ''}
                          onChange={(e) => setWeightsDraft({ ...weightsDraft, [it.id]: e.target.value })}
                        />
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 12 }}>
            <button className="btn" onClick={submitWeights}>Salvar pesos</button>
            <button className="btn secondary" style={{ marginLeft: 8 }} onClick={() => { setSelectedOrderId(null); setSelectedOrder(null); setSelectedItems([]); }}>Fechar</button>
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 12 }}>
        <button className="btn secondary" onClick={load}>Atualizar lista</button>
      </div>
    </div>
  );
}
