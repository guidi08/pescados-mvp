# Migrações (se você já criou o banco)

Se você já executou `supabase/schema.sql` antes desta versão do código, rode **apenas** esta migração adicional:

## 1) Garantir 1 reserva por pedido

Arquivo:

`supabase/migrations/2026_02_16_add_unique_seller_reserve_order.sql`

O que faz:

- cria uma constraint `unique(order_id)` em `seller_reserves`
- isso permite `upsert` seguro (webhook do Stripe pode repetir)

Como aplicar:

1. Abra o SQL Editor no Supabase
2. Cole o conteúdo do arquivo acima
3. Execute
