-- Optional seed data for local/dev
-- You must create users in Supabase Auth UI first, then you can set profiles.role + profiles.seller_id.

insert into public.sellers (id, display_name, legal_name, cnpj, order_email, city, state, cutoff_time, min_order_cents, shipping_fee_cents, b2c_enabled, risk_reserve_bps, risk_reserve_days)
values
  ('11111111-1111-1111-1111-111111111111', 'Distribuidora Exemplo', 'Distribuidora Exemplo LTDA', '00.000.000/0001-00', 'pedidos@exemplo.com', 'São Paulo', 'SP', '18:00', 50000, 2000, true, 0, 60)
on conflict (id) do nothing;

insert into public.products (seller_id, name, description, category, unit, pricing_mode, estimated_box_weight_kg, max_weight_variation_pct, fresh, tags, min_expiry_date, base_price_cents, active)
values
  ('11111111-1111-1111-1111-111111111111', 'Salmão fresco', 'Caixa de salmão fresco vendido por caixa; preço por kg.', 'Salmão', 'cx', 'per_kg_box', 30, 10, true, array['Fresco','Sushi grade'], current_date + 2, 5990, true),
  ('11111111-1111-1111-1111-111111111111', 'Camarão congelado 36/40', 'Camarão congelado.', 'Camarão', 'kg', 'per_unit', null, 0, false, array['Congelado'], current_date + 180, 4590, true)
;

-- variants (calibre) for salmon (price per kg)
insert into public.product_variants (product_id, name, price_cents, active)
select p.id, '3-4kg', 5990, true from public.products p where p.name='Salmão fresco'
union all
select p.id, '4-5kg', 6190, true from public.products p where p.name='Salmão fresco'
;
