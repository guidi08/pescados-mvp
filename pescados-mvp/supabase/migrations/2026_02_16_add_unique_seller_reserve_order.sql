-- Ensure idempotency for rolling reserves (one reserve entry per order)
do $$
begin
  alter table public.seller_reserves
    add constraint seller_reserves_order_unique unique (order_id);
exception
  when duplicate_object then null;
end $$;
