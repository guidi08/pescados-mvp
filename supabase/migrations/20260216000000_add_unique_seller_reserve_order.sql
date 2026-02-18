-- Ensure idempotency for rolling reserves (one reserve entry per order)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'seller_reserves_order_unique'
  ) then
    alter table public.seller_reserves
      add constraint seller_reserves_order_unique unique (order_id);
  end if;
end $$;
