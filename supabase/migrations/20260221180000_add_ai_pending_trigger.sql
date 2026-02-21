-- Add ai_pending flag and trigger for products
alter table public.products
  add column if not exists ai_pending boolean default true;

-- Ensure existing rows without AI are pending
update public.products
set ai_pending = true
where ai_updated_at is null;

-- Trigger to mark pending when relevant fields change
create or replace function public.set_ai_pending_products()
returns trigger as $$
begin
  if (
    new.name is distinct from old.name or
    new.description is distinct from old.description or
    new.unit is distinct from old.unit or
    new.fresh is distinct from old.fresh or
    new.pricing_mode is distinct from old.pricing_mode
  ) then
    new.ai_pending := true;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_products_ai_pending on public.products;
create trigger trg_products_ai_pending
before update on public.products
for each row
execute function public.set_ai_pending_products();
