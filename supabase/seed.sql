-- LotePro - Demo seed (opcional)
-- Cole e rode no Supabase SQL Editor para criar fornecedores e produtos fictícios.
--
-- Observação:
-- 1) Isso NÃO cria usuários. Você cria usuários no Auth e depois vincula seller_id no profiles (se for fornecedor).
-- 2) Os IDs são fixos para evitar duplicação.

-- =====================
-- Sellers (fornecedores)
-- =====================
insert into public.sellers (
  id, display_name, legal_name, cnpj, order_email, city, state,
  cutoff_time, min_order_cents, shipping_fee_cents, b2c_enabled,
  risk_reserve_bps, risk_reserve_days
)
values
  (
    '11111111-1111-1111-1111-111111111111',
    'Atlântico Distribuição',
    'Atlântico Distribuição de Alimentos LTDA',
    '11.111.111/0001-11',
    'pedidos@atlantico.com',
    'São Paulo',
    'SP',
    '18:00',
    80000,
    0,
    true,
    0,
    60
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Maré Alta Pescados',
    'Maré Alta Pescados LTDA',
    '22.222.222/0001-22',
    'pedidos@marealta.com',
    'São Paulo',
    'SP',
    '17:00',
    120000,
    1500,
    false,
    0,
    60
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'Armazém Prime',
    'Armazém Prime Comércio de Alimentos LTDA',
    '33.333.333/0001-33',
    'pedidos@armazemprime.com',
    'São Paulo',
    'SP',
    '19:00',
    50000,
    2000,
    true,
    0,
    60
  )
on conflict (id) do nothing;

-- =====================
-- Products (produtos)
-- category (exemplos): Pescados | Frutos do mar | Iguarias
-- =====================
insert into public.products (
  id, seller_id, name, description, category, unit,
  pricing_mode, estimated_box_weight_kg, max_weight_variation_pct,
  fresh, tags, min_expiry_date, base_price_cents, active
)
values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    'Salmão fresco (caixa)',
    'Caixa com peso variável. Preço por kg. Ideal para sushi e grelha.',
    'Pescados',
    'cx',
    'per_kg_box',
    30,
    10,
    true,
    array['Fresco','Sushi grade'],
    current_date + 2,
    5990,
    true
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '11111111-1111-1111-1111-111111111111',
    'Atum fresco (lombo)',
    'Lombo de atum fresco. Vendido por kg.',
    'Pescados',
    'kg',
    'per_unit',
    null,
    0,
    true,
    array['Fresco'],
    current_date + 2,
    7990,
    true
  ),
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '22222222-2222-2222-2222-222222222222',
    'Tilápia IQF (filé)',
    'Filé de tilápia congelado IQF.',
    'Pescados',
    'kg',
    'per_unit',
    null,
    0,
    false,
    array['Congelado'],
    current_date + 180,
    2390,
    true
  ),
  (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    '22222222-2222-2222-2222-222222222222',
    'Camarão congelado 36/40',
    'Camarão congelado.',
    'Frutos do mar',
    'kg',
    'per_unit',
    null,
    0,
    false,
    array['Congelado'],
    current_date + 365,
    4590,
    true
  ),
  (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    '33333333-3333-3333-3333-333333333333',
    'Polvo cozido (pedaços)',
    'Polvo cozido e congelado.',
    'Frutos do mar',
    'kg',
    'per_unit',
    null,
    0,
    false,
    array['Congelado'],
    current_date + 365,
    6990,
    true
  ),
  (
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    '33333333-3333-3333-3333-333333333333',
    'Ovas (ikura) premium',
    'Ovas premium para culinária japonesa.',
    'Iguarias',
    'kg',
    'per_unit',
    null,
    0,
    false,
    array['Premium'],
    current_date + 90,
    13990,
    true
  )
on conflict (id) do nothing;

-- =====================
-- Variants (calibre) - Salmão
-- =====================
insert into public.product_variants (id, product_id, name, price_cents, active)
values
  ('11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '3-4kg', 5990, true),
  ('22222222-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '4-5kg', 6190, true),
  ('33333333-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5-6kg', 6390, true)
on conflict (id) do nothing;
