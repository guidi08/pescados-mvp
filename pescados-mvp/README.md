# LotePro (MVP)

Marketplace B2B/B2C com **app (comprador)** + **portal do fornecedor** + **API** + **Supabase**.

Principais pontos deste MVP:

- **B2B e B2C** (B2C apenas para fornecedores com logística: `sellers.b2c_enabled`)
- **Pagamento**: cartão + Apple Pay/Google Pay (PaymentSheet) e Pix (QR)
- **Split automático para fornecedor** via **Stripe Connect**
  - Plataforma retém **5% + 3,99%** (comissão + taxa de processamento)
  - **Sem taxa fixa por transação repassada** (por enquanto)
  - **Reserva de risco** (rolling reserve) por **60 dias** (configurável por fornecedor)
- **Cut-off** para entrega D+1
- **Preço/pausa em tempo real**
- **Calibre** com preço próprio
- **Peso variável (salmão por caixa)** com ajuste via **carteira (B2B)**

## Estrutura

- `apps/mobile` — app (Expo React Native)
- `apps/admin` — portal fornecedor (Next.js)
- `apps/api` — backend (Express)
- `supabase/` — SQL (schema + RLS + seed opcional)
- `docs/` — documentação completa (deploy, pagamentos, operação, jurídico)

## Começar rápido (dev)

1. Crie um projeto no Supabase
2. Rode `supabase/schema.sql` e `supabase/rls.sql`
3. Configure `.env` em:
   - `apps/api/.env`
   - `apps/admin/.env.local`
   - `apps/mobile/.env`
4. Rode cada app:
   - API: `cd apps/api && npm i && npm run dev`
   - Admin: `cd apps/admin && npm i && npm run dev`
   - Mobile: `cd apps/mobile && npm i && npx expo start`

> Observação: em ambiente offline, você vai precisar rodar os `npm install` em uma máquina com acesso à internet.

## Deploy e publicação

Veja **`docs/DEPLOY.md`** e **`docs/PUBLICACAO_APP.md`**.

## Aviso

Os documentos jurídicos em `docs/legal/` são **modelos** e devem ser revisados por advogado/contador antes do lançamento.

