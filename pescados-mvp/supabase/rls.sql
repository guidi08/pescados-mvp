-- Supabase RLS policies for Pescados Marketplace (MVP v2)

-- Helper: is_admin()
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$ language sql stable;

-- Helper: current_seller_id()
create or replace function public.current_seller_id()
returns uuid as $$
  select p.seller_id from public.profiles p where p.id = auth.uid();
$$ language sql stable;

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.sellers enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.buyer_wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.seller_reserves enable row level security;

-- PROFILES
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
on public.profiles for insert
with check (id = auth.uid() or public.is_admin());

-- SELLERS
drop policy if exists "sellers_public_select_active" on public.sellers;
create policy "sellers_public_select_active"
on public.sellers for select
using (active = true or owner_user_id = auth.uid() or public.is_admin());

drop policy if exists "sellers_update_owner" on public.sellers;
create policy "sellers_update_owner"
on public.sellers for update
using (owner_user_id = auth.uid() or public.is_admin())
with check (owner_user_id = auth.uid() or public.is_admin());

drop policy if exists "sellers_insert_admin" on public.sellers;
create policy "sellers_insert_admin"
on public.sellers for insert
with check (public.is_admin());

-- PRODUCTS
drop policy if exists "products_select_public_or_owner" on public.products;
create policy "products_select_public_or_owner"
on public.products for select
using (
  active = true
  or seller_id = public.current_seller_id()
  or public.is_admin()
);

drop policy if exists "products_insert_owner" on public.products;
create policy "products_insert_owner"
on public.products for insert
with check (
  seller_id = public.current_seller_id()
  or public.is_admin()
);

drop policy if exists "products_update_owner" on public.products;
create policy "products_update_owner"
on public.products for update
using (
  seller_id = public.current_seller_id()
  or public.is_admin()
)
with check (
  seller_id = public.current_seller_id()
  or public.is_admin()
);

drop policy if exists "products_delete_owner" on public.products;
create policy "products_delete_owner"
on public.products for delete
using (
  seller_id = public.current_seller_id()
  or public.is_admin()
);

-- VARIANTS
drop policy if exists "variants_select_public_or_owner" on public.product_variants;
create policy "variants_select_public_or_owner"
on public.product_variants for select
using (
  active = true
  or exists (
    select 1
    from public.products p
    where p.id = product_id
      and (p.seller_id = public.current_seller_id() or public.is_admin())
  )
);

drop policy if exists "variants_insert_owner" on public.product_variants;
create policy "variants_insert_owner"
on public.product_variants for insert
with check (
  exists (
    select 1
    from public.products p
    where p.id = product_id
      and (p.seller_id = public.current_seller_id() or public.is_admin())
  )
);

drop policy if exists "variants_update_owner" on public.product_variants;
create policy "variants_update_owner"
on public.product_variants for update
using (
  exists (
    select 1
    from public.products p
    where p.id = product_id
      and (p.seller_id = public.current_seller_id() or public.is_admin())
  )
)
with check (
  exists (
    select 1
    from public.products p
    where p.id = product_id
      and (p.seller_id = public.current_seller_id() or public.is_admin())
  )
);

drop policy if exists "variants_delete_owner" on public.product_variants;
create policy "variants_delete_owner"
on public.product_variants for delete
using (
  exists (
    select 1
    from public.products p
    where p.id = product_id
      and (p.seller_id = public.current_seller_id() or public.is_admin())
  )
);

-- ORDERS (buyers + sellers can read; writes go through API using service role)
drop policy if exists "orders_select_buyer_or_seller" on public.orders;
create policy "orders_select_buyer_or_seller"
on public.orders for select
using (
  buyer_id = auth.uid()
  or seller_id = public.current_seller_id()
  or public.is_admin()
);

drop policy if exists "orders_insert_buyer" on public.orders;
create policy "orders_insert_buyer"
on public.orders for insert
with check (buyer_id = auth.uid() or public.is_admin());

drop policy if exists "orders_update_admin_only" on public.orders;
create policy "orders_update_admin_only"
on public.orders for update
using (public.is_admin())
with check (public.is_admin());

-- ORDER ITEMS (buyers + sellers can read; writes go through API)
drop policy if exists "order_items_select_buyer_or_seller" on public.order_items;
create policy "order_items_select_buyer_or_seller"
on public.order_items for select
using (
  exists (
    select 1 from public.orders o
    where o.id = order_id
      and (
        o.buyer_id = auth.uid()
        or o.seller_id = public.current_seller_id()
        or public.is_admin()
      )
  )
);

drop policy if exists "order_items_insert_buyer" on public.order_items;
create policy "order_items_insert_buyer"
on public.order_items for insert
with check (
  exists (
    select 1 from public.orders o
    where o.id = order_id
      and (o.buyer_id = auth.uid() or public.is_admin())
  )
);

drop policy if exists "order_items_update_admin_only" on public.order_items;
create policy "order_items_update_admin_only"
on public.order_items for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "order_items_delete_admin_only" on public.order_items;
create policy "order_items_delete_admin_only"
on public.order_items for delete
using (public.is_admin());

-- BUYER WALLETS
drop policy if exists "wallets_select_own" on public.buyer_wallets;
create policy "wallets_select_own"
on public.buyer_wallets for select
using (buyer_id = auth.uid() or public.is_admin());

drop policy if exists "wallets_update_admin_only" on public.buyer_wallets;
create policy "wallets_update_admin_only"
on public.buyer_wallets for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "wallets_insert_admin_only" on public.buyer_wallets;
create policy "wallets_insert_admin_only"
on public.buyer_wallets for insert
with check (public.is_admin());

-- WALLET TRANSACTIONS
drop policy if exists "wallet_tx_select_own" on public.wallet_transactions;
create policy "wallet_tx_select_own"
on public.wallet_transactions for select
using (buyer_id = auth.uid() or public.is_admin());

drop policy if exists "wallet_tx_insert_admin_only" on public.wallet_transactions;
create policy "wallet_tx_insert_admin_only"
on public.wallet_transactions for insert
with check (public.is_admin());

-- SELLER RESERVES
drop policy if exists "reserves_select_seller_or_admin" on public.seller_reserves;
create policy "reserves_select_seller_or_admin"
on public.seller_reserves for select
using (
  seller_id = public.current_seller_id()
  or public.is_admin()
);

drop policy if exists "reserves_insert_admin_only" on public.seller_reserves;
create policy "reserves_insert_admin_only"
on public.seller_reserves for insert
with check (public.is_admin());

drop policy if exists "reserves_update_admin_only" on public.seller_reserves;
create policy "reserves_update_admin_only"
on public.seller_reserves for update
using (public.is_admin())
with check (public.is_admin());
