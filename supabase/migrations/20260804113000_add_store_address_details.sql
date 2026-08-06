alter table public.stores
  add column if not exists address_number text,
  add column if not exists complement text;
