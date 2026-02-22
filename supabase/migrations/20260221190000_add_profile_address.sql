-- Add address jsonb to profiles
alter table public.profiles
  add column if not exists address jsonb;
