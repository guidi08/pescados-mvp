# Visão geral

Este MVP implementa um marketplace de pescados/frutos do mar com:

- **App (Expo / React Native)** para compradores (B2B e B2C)
- **Portal do fornecedor (Next.js)** para cadastro e atualização de produtos em tempo real
- **API (Node/Express)** para:
  - criar pedidos e calcular regras
  - integrar pagamentos (Stripe)
  - receber webhooks (pagamento aprovado/reprovado)
  - enviar e-mails de pedido para o fornecedor
  - jobs (liberação da reserva de risco)
- **Banco (Supabase/Postgres)** com RLS

## Objetivo do MVP

1. Rodar uma operação enxuta (SP capital, poucos fornecedores, catálogo curto).
2. Garantir que o fornecedor consiga:
   - ajustar preço e disponibilidade rapidamente
   - receber pedidos com clareza (e-mail + portal)
3. Garantir que o comprador consiga:
   - comprar com cartão / Apple Pay / Google Pay
   - pagar com Pix via QR
4. Evitar complexidade de “caixa de fornecedor”:
   - split automático (Stripe Connect)
   - plataforma retém apenas sua taxa (**5% + 3,99%**) e, opcionalmente, uma **reserva de risco** temporária.

## O que está dentro do escopo agora

- 1 cidade (São Paulo capital)
- Frete **fixo ou zero** por fornecedor (MVP)
- Pedido mínimo por fornecedor
- Cut-off para entrega D+1
- Cancelamento: congelados até 6h antes do cut-off; frescos sem cancelamento
- Produto com **peso variável por caixa** (ex.: salmão), com ajuste por carteira em B2B

## O que fica para versão seguinte

- Frete calculado por CEP / distância
- Tracking de entrega (motoboy, roteirização)
- Split avançado (taxas por meio de pagamento, antecipação, etc.)
- KYC/antifraude mais profundo (SMS, biometria, consulta CPF/CNPJ)
- Faturamento e conciliação fiscal automatizados (NF-e/NFS-e)
