-- ============================================================
-- Storage Policies for seller-logos and product-images buckets
-- ============================================================

-- Bucket: seller-logos (public read, seller-scoped write)
insert into storage.buckets (id, name, public)
values ('seller-logos', 'seller-logos', true)
on conflict (id) do nothing;

drop policy if exists "Public read seller logos" on storage.objects;
create policy "Public read seller logos"
on storage.objects
for select
using (bucket_id = 'seller-logos');

drop policy if exists "Seller upload own logos" on storage.objects;
create policy "Seller upload own logos"
on storage.objects
for insert
with check (
  bucket_id = 'seller-logos'
  and public.current_seller_id() is not null
  and name like (public.current_seller_id()::text || '/%')
);

drop policy if exists "Seller update own logos" on storage.objects;
create policy "Seller update own logos"
on storage.objects
for update
using (
  bucket_id = 'seller-logos'
  and public.current_seller_id() is not null
  and name like (public.current_seller_id()::text || '/%')
)
with check (
  bucket_id = 'seller-logos'
  and public.current_seller_id() is not null
  and name like (public.current_seller_id()::text || '/%')
);

drop policy if exists "Seller delete own logos" on storage.objects;
create policy "Seller delete own logos"
on storage.objects
for delete
using (
  bucket_id = 'seller-logos'
  and public.current_seller_id() is not null
  and name like (public.current_seller_id()::text || '/%')
);

-- Bucket: product-images (public read, seller-scoped write)
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "Public read product images" on storage.objects;
create policy "Public read product images"
on storage.objects
for select
using (bucket_id = 'product-images');

drop policy if exists "Seller upload own product images" on storage.objects;
create policy "Seller upload own product images"
on storage.objects
for insert
with check (
  bucket_id = 'product-images'
  and public.current_seller_id() is not null
  and name like (public.current_seller_id()::text || '/%')
);

drop policy if exists "Seller update own product images" on storage.objects;
create policy "Seller update own product images"
on storage.objects
for update
using (
  bucket_id = 'product-images'
  and public.current_seller_id() is not null
  and name like (public.current_seller_id()::text || '/%')
)
with check (
  bucket_id = 'product-images'
  and public.current_seller_id() is not null
  and name like (public.current_seller_id()::text || '/%')
);

drop policy if exists "Seller delete own product images" on storage.objects;
create policy "Seller delete own product images"
on storage.objects
for delete
using (
  bucket_id = 'product-images'
  and public.current_seller_id() is not null
  and name like (public.current_seller_id()::text || '/%')
);
