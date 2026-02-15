# Plano MVP (execução rápida)

## Fase 1 — Infra + Base (hoje)
- [x] Criar workspace no Desktop
- [x] Gerar .env a partir dos exemplos (sem chaves)
- [ ] Criar projeto Supabase e aplicar SQL
- [ ] Habilitar realtime nas tabelas (products, product_variants, orders)
- [ ] Criar bucket `product-images` (opcional)

## Fase 2 — API (Railway)
- [ ] Deploy da API no Railway
- [ ] Configurar envs no Railway
- [ ] Validar health check

## Fase 3 — Stripe
- [ ] Habilitar Connect + Pix
- [ ] Criar webhook (payment_intent.succeeded/failed/canceled, account.updated)
- [ ] Colar STRIPE_WEBHOOK_SECRET na API

## Fase 4 — Admin (Portal)
- [ ] Deploy no Vercel (ou Railway)
- [ ] Configurar envs

## Fase 5 — App
- [ ] Expo/EAS build
- [ ] TestFlight + Play Console

## Fase 6 — Operação
- [ ] Onboarding 2–5 fornecedores
- [ ] Testes reais (B2B)
- [ ] Ajustes de regra e cut‑off
