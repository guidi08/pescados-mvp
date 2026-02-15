-- Supabase schema for Pescados Marketplace (MVP v2)
-- Run this inside Supabase SQL editor (in order): schema.sql then rls.sql.
-- Notes:
-- - Uses Supabase Auth (auth.users) for users
-- - Uses Stripe Connect for split payouts (seller receives GMV - fees; platform receives fees)

create extension if not exists "pgcrypto";

-- 1) Profiles (1:1 with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,

  -- buyer | seller | admin
  role text not null default 'buyer' check (role in ('buyer','seller','admin')),

  full_name text,
  phone text,

  -- identification (buyer can be CPF or CNPJ; seller will be a separate entity in sellers table)
  cpf text,
  cnpj text,
  company_name text,

  -- if role=seller, link to sellers.id
  seller_id uuid,

  -- Stripe customer id for buyers
  stripe_customer_id text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create profile on new auth user (keeps email)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'buyer')
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- 2) Sellers (indústrias/distribuidoras)
create table if not exists public.sellers (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete set null,

  display_name text not null,
  legal_name text,
  cnpj text,
  order_email text not null,
  phone text,

  address jsonb,
  city text,
  state text,

  active boolean not null default true,

  -- operational rules
  cutoff_time time not null default '18:00', -- pedidos até esse horário entregam D+1
  timezone text not null default 'America/Sao_Paulo',
  min_order_cents integer not null default 0,

  -- shipping: fixed or zero (MVP)
  shipping_fee_cents integer not null default 0,

  -- b2c enablement (only sellers with logistics)
  b2c_enabled boolean not null default false,

  -- risk reserve (rolling reserve)
  risk_reserve_bps integer not null default 0, -- ex: 1000 = 10%
  risk_reserve_days integer not null default 60,

  -- Stripe Connect (Express)
  stripe_account_id text,
  stripe_account_charges_enabled boolean not null default false,
  stripe_account_payouts_enabled boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) Products
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers(id) on delete cascade,

  name text not null,
  description text,
  category text,
  unit text not null default 'kg', -- kg, cx, un, etc

  -- pricing modes:
  -- - per_unit: total = unit_price * quantity
  -- - per_kg_box: quantity=boxes, unit_price is per kg, total uses estimated_box_weight_kg
  pricing_mode text not null default 'per_unit' check (pricing_mode in ('per_unit','per_kg_box')),

  -- variable weight box config (only for per_kg_box)
  estimated_box_weight_kg numeric(10,3),
  max_weight_variation_pct numeric(5,2) not null default 0, -- ex: 10.0

  fresh boolean not null default false,
  tags text[], -- e.g. {'Fresco','Sushi grade'}

  min_expiry_date date, -- validade mínima do lote (campo simples para o MVP)
  active boolean not null default true,

  base_price_cents integer not null, -- per unit (per_unit) OR per kg (per_kg_box)
  currency text not null default 'brl',
  images jsonb, -- array de URLs

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4) Product variants (calibre/tamanho)
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,

  name text not null, -- ex: "Salmão 3-4kg"
  sku text,
  active boolean not null default true,

  -- price per unit (per_unit) OR per kg (per_kg_box)
  price_cents integer not null,

  min_expiry_date date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5) Orders
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),

  buyer_id uuid not null references auth.users(id) on delete restrict,
  seller_id uuid not null references public.sellers(id) on delete restrict,

  buyer_channel text not null default 'b2c' check (buyer_channel in ('b2b','b2c')),

  status text not null default 'pending_payment'
    check (status in ('pending_payment','paid','canceled','fulfilled')),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid','processing','succeeded','failed','canceled','refunded','partially_refunded')),

  payment_provider text, -- stripe
  payment_method text, -- card | pix
  payment_intent_id text,
  charge_id text,

  -- money breakdown (snapshot)
  subtotal_cents integer not null,
  shipping_cents integer not null default 0,
  total_cents integer not null,
  currency text not null default 'brl',

  platform_commission_cents integer not null default 0, -- 5%
  platform_processing_cents integer not null default 0, -- 3.99% (sem taxa fixa)
  platform_fee_cents integer not null default 0, -- commission + processing
  risk_reserve_cents integer not null default 0,
  seller_payout_cents integer not null default 0, -- amount intended to be transferred to seller

  contains_fresh boolean not null default false,

  delivery_date date,
  delivery_notes text,
  delivery_address jsonb,

  created_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);

-- 6) Order items
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,

  product_id uuid not null references public.products(id),
  variant_id uuid references public.product_variants(id),

  -- snapshots to keep pricing stable even if seller changes product after
  product_name_snapshot text not null,
  variant_name_snapshot text,
  unit_snapshot text not null,

  fresh_snapshot boolean not null default false,
  min_expiry_date_snapshot date,

  pricing_mode_snapshot text not null default 'per_unit' check (pricing_mode_snapshot in ('per_unit','per_kg_box')),
  unit_price_cents_snapshot integer not null, -- per unit or per kg
  quantity numeric(10,3) not null default 1,

  -- for per_kg_box (estimate & actual)
  estimated_total_weight_kg_snapshot numeric(10,3),
  actual_total_weight_kg numeric(10,3),

  line_total_cents_snapshot integer not null, -- estimated line total at purchase time

  created_at timestamptz not null default now()
);

-- 7) Buyer wallet (saldo) for B2B adjustments (peso variável etc.)
create table if not exists public.buyer_wallets (
  buyer_id uuid primary key references auth.users(id) on delete cascade,
  balance_cents integer not null default 0,
  currency text not null default 'brl',
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,

  amount_cents integer not null, -- positive = credit, negative = debit
  kind text not null check (kind in (
    'weight_adjustment',
    'manual_adjustment',
    'topup',
    'refund'
  )),
  note text,
  metadata jsonb,

  created_at timestamptz not null default now()
);

-- 8) Rolling reserve ledger (platform holds temporarily and releases later)
create table if not exists public.seller_reserves (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,

  amount_cents integer not null,
  currency text not null default 'brl',

  status text not null default 'held' check (status in ('held','released','forfeited')),
  release_at timestamptz not null,

  stripe_transfer_id text,
  released_at timestamptz,

  created_at timestamptz not null default now()
);

-- Triggers to keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_sellers_updated_at on public.sellers;
create trigger trg_sellers_updated_at
before update on public.sellers
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
before update on public.products
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_variants_updated_at on public.product_variants;
create trigger trg_variants_updated_at
before update on public.product_variants
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
before update on public.orders
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_wallets_updated_at on public.buyer_wallets;
create trigger trg_wallets_updated_at
before update on public.buyer_wallets
for each row execute procedure public.set_updated_at();

-- Helpful indexes
create index if not exists idx_products_seller on public.products(seller_id);
create index if not exists idx_variants_product on public.product_variants(product_id);
create index if not exists idx_orders_buyer on public.orders(buyer_id);
create index if not exists idx_orders_seller on public.orders(seller_id);
create index if not exists idx_reserves_release_at on public.seller_reserves(status, release_at);
