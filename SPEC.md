# Pescados Marketplace — MVP v2

Este repositório contém um MVP completo (app + portal + API + banco) para um marketplace de pescados/frutos do mar com:

- **B2B e B2C**
  - B2C apenas para fornecedores com logística (flag `sellers.b2c_enabled`).
- **Pagamentos**: cartão + Apple Pay/Google Pay (via PaymentSheet) e Pix (QR).
- **Split automático para fornecedor** via **Stripe Connect (Express)**:
  - O fornecedor recebe **GMV – (5% + 3,99%) – reserva de risco (se houver)**.
  - A plataforma retém **apenas**: **5% (comissão) + 3,99% (taxa de processamento)**.
  - A plataforma **não repassa** a taxa fixa por transação (ex.: R$0,39) neste momento — ela fica como custo da operação.
- **Reserva de risco (rolling reserve)**: % configurável por fornecedor, retida por **60 dias** e liberada automaticamente por um job.
- **Operação (SP capital)**: fornecedores definem frete fixo (ou zero) e cut-off para entrega D+1.

> **Importante**: este é um MVP técnico. Termos/Políticas são modelos e devem passar por revisão jurídica/contábil.

---

## Apps/serviços incluídos

- `apps/mobile` — Expo React Native (cliente)
- `apps/admin` — Next.js (portal fornecedor)
- `apps/api` — Node/Express (criação de pedidos, pagamentos, webhooks, e-mail, jobs)
- `supabase/` — SQL do banco + RLS + seed opcional

---

## Regras de negócio implementadas (núcleo)

- **Cut-off para entrega D+1**: pedidos até `sellers.cutoff_time` entregam no dia seguinte; após o cut-off, entregam D+2.
- **Preço e pausa em tempo real**: fornecedor altera `products.base_price_cents` e `products.active` e o app reflete em tempo real (Supabase Realtime).
- **Fresco vs congelado**: `products.fresh` + `tags[]` + `min_expiry_date`.
- **Calibre**: `product_variants` com preço próprio.
- **Cancelamento**
  - Itens frescos: **sem cancelamento**
  - Congelados: cancelamento até **6h antes** do cut-off (na véspera da entrega).
- **Salmão / peso variável**
  - `pricing_mode = per_kg_box`: compra por **caixa**, preço por **kg**, com peso estimado.
  - Em B2B, o fornecedor lança o **peso real** e o sistema gera **crédito/débito** em **carteira** do comprador.

---

## Como rodar (visão rápida)

1) Criar projeto no Supabase e rodar SQL (`supabase/schema.sql` + `supabase/rls.sql`)  
2) Criar conta Stripe e habilitar **Connect + Webhook + Pix**  
3) Subir `apps/api` (Render/Fly/etc)  
4) Subir `apps/admin` (Vercel)  
5) Rodar `apps/mobile` via Expo / EAS (TestFlight + Play Console)

Veja `docs/DEPLOY.md` para passo a passo.

