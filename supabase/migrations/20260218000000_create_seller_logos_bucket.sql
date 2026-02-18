-- Create public bucket for seller logos
insert into storage.buckets (id, name, public)
values ('seller-logos', 'seller-logos', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload/replace logos
drop policy if exists "seller_logos_insert" on storage.objects;
create policy "seller_logos_insert"
on storage.objects for insert
with check (
  bucket_id = 'seller-logos'
  and auth.role() = 'authenticated'
);

drop policy if exists "seller_logos_update" on storage.objects;
create policy "seller_logos_update"
on storage.objects for update
using (
  bucket_id = 'seller-logos'
  and auth.role() = 'authenticated'
);

drop policy if exists "seller_logos_select" on storage.objects;
create policy "seller_logos_select"
on storage.objects for select
using (
  bucket_id = 'seller-logos'
);
