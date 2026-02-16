# Modelo de dados (Supabase/Postgres)

Arquivos:
- `supabase/schema.sql`
- `supabase/rls.sql`

## Tabelas principais

### `profiles`
- 1:1 com `auth.users`
- Papel (`role`): buyer / seller / admin
- CPF/CNPJ do comprador (define B2C/B2B)
- `seller_id` (se o usuário for fornecedor)

### `sellers`
- Fornecedor (empresa)
- Configurações operacionais (cut-off, frete fixo, pedido mínimo)
- B2C habilitado
- Reserva de risco (% e dias)
- Stripe Connect: `stripe_account_id`, `charges_enabled`, `payouts_enabled`

### `products`
- Produtos do fornecedor
- `pricing_mode`: per_unit | per_kg_box
- per_kg_box: `estimated_box_weight_kg`, `max_weight_variation_pct`

### `product_variants`
- Calibre/tamanho com preço próprio

### `orders`
- Pedido (snapshot financeiro):
  - `subtotal_cents`, `shipping_cents`, `total_cents`
  - `platform_commission_cents`, `platform_processing_cents`, `platform_fee_cents`
  - `risk_reserve_cents`, `seller_payout_cents`
- Status:
  - `status`: pending_payment | paid | canceled | fulfilled
  - `payment_status`: unpaid | processing | succeeded | failed | canceled | refunded...

### `order_items`
- Snapshot do item no momento do pedido
- Para `per_kg_box`:
  - `estimated_total_weight_kg_snapshot`
  - `actual_total_weight_kg`
  - `line_total_cents_snapshot` (estimado no momento da compra)

### `buyer_wallets` / `wallet_transactions`
- Carteira do comprador (B2B)
- Ledger de ajustes (peso real, topup, etc.)

### `seller_reserves`
- Ledger da reserva de risco
- `release_at` (agendado)
- job libera e registra `stripe_transfer_id`

## RLS (segurança)

- Comprador vê seus pedidos
- Fornecedor vê seus pedidos e seus produtos
- Escritas sensíveis (orders update, wallet, reserves) passam pela API (service role) para garantir regra de negócio
