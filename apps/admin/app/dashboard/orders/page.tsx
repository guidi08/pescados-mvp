'use client';

import { useEffect, useState } from 'react';
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
    if (!session) { window.location.href = '/login'; return; }

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

  useEffect(() => { load(); }, []);

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
    if (!apiBase) { setMsg('Faltou NEXT_PUBLIC_API_BASE_URL no ambiente do portal.'); return; }

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) { setMsg('Sessao expirada. Faca login novamente.'); return; }

    const payloadItems = selectedItems
      .filter((it) => it.pricing_mode_snapshot === 'per_kg_box')
      .map((it) => ({
        orderItemId: it.id,
        actualTotalWeightKg: Number(String(weightsDraft[it.id] ?? '').replace(',', '.')),
      }))
      .filter((x) => Number.isFinite(x.actualTotalWeightKg) && x.actualTotalWeightKg > 0);

    if (!payloadItems.length) { setMsg('Nenhum item com peso variavel para atualizar.'); return; }

    const resp = await fetch(`${apiBase}/orders/${selectedOrderId}/weights`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'authorization': `Bearer ${token}` },
      body: JSON.stringify({ items: payloadItems }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      setMsg(`Erro ao atualizar pesos: ${err.error ?? resp.status}`);
      return;
    }

    const ok = await resp.json().catch(() => ({}));
    setMsg(`__success__Pesos atualizados (delta: ${centsToBRL(ok.deltaCents ?? 0)})`);
    await openOrder(selectedOrderId);
  }

  const isSuccess = msg?.startsWith('__success__');
  const displayMsg = isSuccess ? msg?.replace('__success__', '') : msg;

  if (loading) {
    return (
      <div className="container">
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <p style={{ color: 'var(--text-secondary)' }}>Carregando pedidos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Pedidos</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn ghost sm" onClick={load}>Atualizar</button>
          <a className="btn ghost sm" href="/dashboard">&larr; Voltar</a>
        </div>
      </div>

      {displayMsg && (
        <div className={isSuccess ? 'msg-success' : 'msg-error'} style={{ marginBottom: 16 }}>
          {displayMsg}
        </div>
      )}

      {/* Orders table */}
      <div className="card" style={{ marginBottom: 20 }}>
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
                  <td data-label="ID" style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-tertiary)' }}>{o.id.slice(0, 8)}&hellip;</td>
                  <td data-label="Data">{new Date(o.created_at).toLocaleString('pt-BR')}</td>
                  <td data-label="Entrega">{o.delivery_date}</td>
                  <td data-label="Canal">
                    <span className={`badge ${o.buyer_channel === 'b2b' ? 'b2b' : 'b2c'}`}>
                      {o.buyer_channel?.toUpperCase()}
                    </span>
                  </td>
                  <td data-label="Status">
                    <span className={`badge ${o.payment_status === 'succeeded' ? 'success' : 'neutral'}`}>
                      {o.status} / {o.payment_status}
                    </span>
                    {o.contains_fresh && <span className="badge fresh" style={{ marginLeft: 6 }}>Fresco</span>}
                  </td>
                  <td data-label="Total" style={{ fontWeight: 600 }}>{centsToBRL(o.total_cents)}</td>
                  <td data-label="Acoes">
                    <button className="btn secondary sm" onClick={() => openOrder(o.id)}>Detalhes</button>
                  </td>
                </tr>
              ))}
              {!orders.length && (
                <tr>
                  <td colSpan={7} style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 32 }}>
                    Nenhum pedido encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail */}
      {selectedOrderId && selectedOrder && (
        <div className="card card-accent">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Pedido {selectedOrderId.slice(0, 8)}&hellip;</h3>
            <button className="btn ghost sm" onClick={() => { setSelectedOrderId(null); setSelectedOrder(null); setSelectedItems([]); }}>
              Fechar
            </button>
          </div>

          <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginBottom: 16 }}>
            Atualize pesos apenas para itens "por caixa com peso variavel". Isso gera ajuste automatico no saldo do cliente (B2B).
          </p>

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
                    <td data-label="Item" style={{ fontWeight: 500 }}>
                      {it.product_name_snapshot}
                      {it.variant_name_snapshot && <span style={{ color: 'var(--text-tertiary)' }}> ({it.variant_name_snapshot})</span>}
                    </td>
                    <td data-label="Modo">
                      <span className={`badge ${it.pricing_mode_snapshot === 'per_kg_box' ? 'warning' : 'neutral'}`}>
                        {it.pricing_mode_snapshot === 'per_kg_box' ? 'Peso variavel' : 'Por unidade'}
                      </span>
                    </td>
                    <td data-label="Qtd">{it.quantity}</td>
                    <td data-label="Estimado">{it.estimated_total_weight_kg_snapshot ?? '\u2014'}</td>
                    <td data-label="Peso real">
                      {it.pricing_mode_snapshot === 'per_kg_box' ? (
                        <input
                          className="input"
                          style={{ maxWidth: 140 }}
                          value={weightsDraft[it.id] ?? ''}
                          onChange={(e) => setWeightsDraft({ ...weightsDraft, [it.id]: e.target.value })}
                        />
                      ) : '\u2014'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button className="btn" onClick={submitWeights}>Salvar pesos</button>
          </div>
        </div>
      )}
    </div>
  );
}
