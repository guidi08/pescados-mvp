-- Add AI classification fields to products
alter table public.products
  add column if not exists ai_normalized_name text,
  add column if not exists ai_category text,
  add column if not exists ai_subcategory text,
  add column if not exists ai_menu_group text,
  add column if not exists ai_tags text[],
  add column if not exists ai_confidence numeric,
  add column if not exists ai_updated_at timestamptz;
