# Operação diária (runbook)

## Rotina do fornecedor

- Manter preços e disponibilidade atualizados no portal
- Conferir validade mínima (lote)
- Receber pedido por e-mail e separar itens
- Para salmão (peso variável):
  - lançar peso real no portal (endpoint de peso)
  - sistema gera ajuste em carteira (B2B)

## Rotina da plataforma (admin)

- Onboarding de fornecedor:
  - criar seller no Supabase
  - criar usuário do fornecedor no Supabase Auth
  - vincular `profiles.seller_id`
  - solicitar que finalize Stripe Connect
- Monitorar:
  - webhooks Stripe
  - saldo de reservas
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

> Para automação fiscal (NF-e / NFS-e), recomenda-se integração futura com ERP.
