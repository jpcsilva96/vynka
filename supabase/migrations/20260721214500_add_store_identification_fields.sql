alter table public.stores
  add column if not exists responsible_name text,
  add column if not exists tax_document text;
