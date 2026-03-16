-- Add address column to profiles for delivery address (B2C requirement)
alter table public.profiles add column if not exists address jsonb;

comment on column public.profiles.address is 'Delivery address (street, number, neighborhood, city, state, postal_code, complement, reference)';
