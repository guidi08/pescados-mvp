# Pescados MVP — Status/Log (auto)

Última atualização: 2026-02-14 23:55 (America/New_York)

## Contexto rápido
- Projeto: pescados-mvp
- Infra: Supabase + Railway
- Apps: API (apps/api) + Mobile (apps/mobile)

## O que já foi feito (resumo)
### Supabase
- Projeto criado (região São Paulo / sa-east-1).
- schema.sql, rls.sql, seed.sql aplicados.
- Realtime ativado para: products, product_variants, orders.
- Bucket criado: product-images.
- Senha do banco gerada e salva em:
  - /Users/guilhermesbot/Desktop/Pescados_MVP/supabase_db_password.txt
- Chaves geradas e salvas em:
  - /Users/guilhermesbot/Desktop/Pescados_MVP/supabase_keys.txt

### Railway (API)
- Root directory ajustado para /apps/api.
- Variáveis Supabase setadas.
- Build falhava por falta de types:
  - @types/nodemailer
  - @types/luxon
- Correção feita e enviada ao GitHub (main):
  - commit "Add missing types for nodemailer and luxon"
- Serviço voltou a ficar Online após deploy.
- Crash recente: API caiu por falta de variáveis STRIPE_* (validação em runtime).
  - Foi colocado placeholder temporário para manter serviço Online.
  - Pendente: substituir por chaves reais do Stripe (SECRET, PUBLISHABLE, WEBHOOK).

### Mobile (design)
- Design pack recebido e analisado no ZIP:
  - design-tokens.json
  - DESIGN_SYSTEM.md
  - SCREENS_FIGMA_READY.md
  - BRAND_GUIDE.md
  - NAVIGATION_MAP.md
  - IMPLEMENTATION_CHECKLIST.md
- Implementação iniciada no app mobile:
  - Theme tokens em src/theme
  - Componentes base: Button, Input, Card, Badge, Chip
  - Telas atualizadas com novo design: Login, Home, Seller, Product, Cart, Checkout, Pix, Orders
- Commits locais (workspace):
  - 42e0ad1 Add mobile theme tokens and base UI components
  - 19244c7 Refine seller and product screens with design system
  - 7184bc7 Apply design system to cart, checkout, pix, and orders
- Commit enviado ao GitHub (repo guidi08/pescados-mvp):
  - a643357 Apply design system to mobile UI

## Onde errei / aprendi (para não repetir)
1) Railway crash pós-deploy:
   - Causa: variáveis STRIPE_* não configuradas, validação obrigatória no backend.
   - Correção temporária: placeholders (mantém online, mas precisa chave real antes de produção).
   - Ação definitiva: inserir STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY e STRIPE_WEBHOOK_SECRET reais.

2) Build falhando no Railway:
   - Causa: falta @types/nodemailer e @types/luxon.
   - Correção: adicionar em devDependencies e fazer push.

3) Git push no workspace principal:
   - Causa: repo local sem remote configurado.
   - Correção: clonar repo oficial em /Users/guilhermesbot/clawd/tmp/pescados-mvp-repo e fazer push lá.

## Progresso (estimativa)
- Infra (Supabase + Railway): **90%**
- Backend/API (build + deploy): **85%**
- Mobile UI (design aplicado): **70%**
- Pagamentos (Stripe real): **10%**
- Publicação (EAS/TestFlight/Play): **5%**
- Testes finais (fluxos + QA): **10%**

## Pendências atuais (próximos passos)
1) Stripe
- Criar chaves reais e webhook
- Substituir placeholders no Railway

2) EAS/TestFlight/Play Console
- Aguardando dados do usuário:
  - Nome app final, bundle ID (iOS) e package (Android)
  - Apple Developer (Apple ID do time)
  - Google Play Console (e-mail proprietário)
  - Expo/EAS (login)
  - Ícone 1024x1024, splash
  - E-mail suporte + site/política privacidade

3) Testes
- Rodar o app mobile e validar fluxos

## Observações importantes
- Quando o usuário disser "projeto pescado", refere-se a este projeto (pescados-mvp).

