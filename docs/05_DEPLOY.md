# Deploy (passo a passo)

## 0) Pré-requisitos

- Conta Supabase
- Conta Stripe
- Conta Vercel (portal)
- Um host para API (Render/Fly/Railway/etc)
- Um domínio (opcional, mas recomendado)

---

## 1) Supabase

1. Crie um projeto
2. No SQL editor, execute na ordem:
   - `supabase/schema.sql`
   - `supabase/rls.sql`
   - (opcional) `supabase/seed.sql`
3. Em **Database → Replication**, habilite realtime nas tabelas:
   - `products`
   - `product_variants`
   - `orders`
4. (Opcional) Crie bucket `product-images` no Storage

---

## 2) Stripe

1. Pegue:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_PUBLISHABLE_KEY`
2. Habilite:
   - Stripe Connect
   - Pix (se disponível na sua conta)
3. Configure Webhook apontando para a API:
   - `POST https://SEU_API/webhooks/stripe`
   - Eventos mínimos:
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `payment_intent.canceled`
     - `account.updated`
4. Copie o `STRIPE_WEBHOOK_SECRET` do endpoint

---

## 3) API (apps/api)

### Variáveis

Copie `apps/api/.env.example` para `apps/api/.env` e preencha.

### Deploy (Render, exemplo)

- Create Web Service
- Build command: `npm install && npm run build`
- Start command: `npm run start`
- Configure env vars no painel
- Após deploy: atualize o Webhook da Stripe para apontar para a URL definitiva

### Job de liberação da reserva de risco

- Defina `JOB_SECRET` na API
- Crie um cron (Render Cron / GitHub Actions) chamando:
  - `POST https://SEU_API/jobs/release-reserves`
  - Header: `x-job-secret: <JOB_SECRET>`

---

## 4) Portal do fornecedor (apps/admin)

- Deploy no Vercel
- Configure env:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_API_BASE_URL`

---

## 5) App (apps/mobile)

- Expo Dev:
  - `npx expo start`
- Produção:
  - EAS Build + TestFlight + Play Console

Configure `.env` com:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_API_BASE_URL`

> Para Apple Pay em produção, você precisará configurar Merchant ID no Apple Developer e ajustar o `merchantIdentifier` no `StripeProvider`.
