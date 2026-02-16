# Operação diária (runbook)

## Rotina do fornecedor

- Manter preços e disponibilidade atualizados no portal
- Conferir validade mínima (lote)
- Receber pedido por e-mail e separar itens
- Para salmão (peso variável):
  - lançar peso real no portal em **Dashboard → Pedidos**
  - sistema gera ajuste em carteira (B2B)
  - se o cliente ficar com saldo negativo, ele precisará quitar (app → Saldo) antes de fazer novos pedidos

## Rotina da plataforma (admin)

- Onboarding de fornecedor:
  - criar seller no Supabase
  - criar usuário do fornecedor no Supabase Auth
  - vincular `profiles.seller_id`
  - solicitar que finalize Stripe Connect
- Monitorar:
  - webhooks Stripe
  - saldo de reservas (seller_reserves)
  - chargebacks/disputas
- Suporte:
  - cancelamentos congelados (janela)
  - itens frescos: orientar política de não cancelamento

## Conciliação simples (MVP)

- Stripe Dashboard:
  - exportar transações/payouts
- Supabase:
  - orders (snapshot)
  - seller_reserves (ledger)
  - wallet_transactions (ajustes B2B)

## Reserva de risco (60 dias)

- Quando o pedido é pago, se houver reserva configurada no fornecedor, ela entra em `seller_reserves` como **held**.
- Um job (cron) chama `POST /jobs/release-reserves` e libera automaticamente quando `release_at` chega.
- Se houver reembolso/cancelamento, a reserva do pedido é marcada como **forfeited** (não libera).

> Para automação fiscal (NF-e / NFS-e), recomenda-se integração futura com ERP.
