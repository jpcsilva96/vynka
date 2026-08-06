alter table public.categories
  add column if not exists parent_id uuid references public.categories(id) on delete restrict;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'categories_parent_not_self'
      and conrelid = 'public.categories'::regclass
  ) then
    alter table public.categories
      add constraint categories_parent_not_self check (parent_id is null or parent_id <> id);
  end if;
end $$;

create index if not exists idx_categories_parent on public.categories(parent_id);
create index if not exists idx_categories_store_parent_order on public.categories(store_id, parent_id, display_order);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'categories_store_slug_unique'
      and conrelid = 'public.categories'::regclass
  ) then
    alter table public.categories
      add constraint categories_store_slug_unique unique (store_id, slug);
  end if;
end $$;
