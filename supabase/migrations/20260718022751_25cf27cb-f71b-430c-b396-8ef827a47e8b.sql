
-- ============ ENUMS ============
create type public.store_status as enum ('trial','active','suspended','cancelled');
create type public.subscription_status as enum ('trial','active','past_due','suspended','cancelled');
create type public.member_role as enum ('owner','admin','seller');
create type public.platform_role as enum ('platform_owner','super_admin','support');
create type public.order_status as enum ('pending','confirmed','shipped','delivered','cancelled');
create type public.order_source as enum ('website','whatsapp','manual');

-- ============ TABLES ============

-- profiles
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- plans
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  max_products integer not null default 50,
  max_users integer not null default 1,
  allow_site_orders boolean not null default false,
  allow_whatsapp_orders boolean not null default true,
  allow_custom_domain boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.plans to anon, authenticated;
grant all on public.plans to service_role;
alter table public.plans enable row level security;

-- stores
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  banner_url text,
  description text,
  phone text,
  whatsapp text,
  email text,
  instagram text,
  facebook text,
  tiktok text,
  address text,
  status public.store_status not null default 'trial',
  plan_id uuid references public.plans(id) on delete set null,
  trial_ends_at timestamptz,
  subscription_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.stores to anon, authenticated;
grant insert, update, delete on public.stores to authenticated;
grant all on public.stores to service_role;
alter table public.stores enable row level security;

-- store_members
create table public.store_members (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'owner',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, user_id)
);
grant select, insert, update, delete on public.store_members to authenticated;
grant all on public.store_members to service_role;
alter table public.store_members enable row level security;

-- platform_users
create table public.platform_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role public.platform_role not null default 'platform_owner',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.platform_users to authenticated;
grant all on public.platform_users to service_role;
alter table public.platform_users enable row level security;

-- subscriptions
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  status public.subscription_status not null default 'trial',
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;
alter table public.subscriptions enable row level security;

-- customers
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.customers to authenticated;
grant all on public.customers to service_role;
alter table public.customers enable row level security;

-- orders
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  status public.order_status not null default 'pending',
  subtotal numeric not null default 0,
  total numeric not null default 0,
  source public.order_source not null default 'whatsapp',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;

-- order_items
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name text not null,
  variant_name text,
  quantity integer not null default 1,
  unit_price numeric not null default 0,
  total_price numeric not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.order_items to authenticated;
grant all on public.order_items to service_role;
alter table public.order_items enable row level security;

-- store_settings
create table public.store_settings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  setting_key text not null,
  setting_value jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, setting_key)
);
grant select on public.store_settings to anon;
grant select, insert, update, delete on public.store_settings to authenticated;
grant all on public.store_settings to service_role;
alter table public.store_settings enable row level security;

-- audit_logs
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_type text not null default 'user',
  store_id uuid references public.stores(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);
grant select, insert on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;

-- ============ EXISTING TABLES: add store_id + fields ============
alter table public.categories add column store_id uuid references public.stores(id) on delete cascade;
alter table public.categories add column active boolean not null default true;
alter table public.categories add column display_order integer not null default 0;

alter table public.products add column store_id uuid references public.stores(id) on delete cascade;
alter table public.products add column slug text;
alter table public.products add column display_order integer not null default 0;

alter table public.product_variants add column store_id uuid references public.stores(id) on delete cascade;

-- ============ HELPER FUNCTIONS (SECURITY DEFINER) ============
create or replace function public.is_platform_admin(_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.platform_users
    where user_id = _user_id and active = true
      and role in ('platform_owner','super_admin')
  );
$$;

create or replace function public.is_store_member(_store_id uuid, _user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.store_members
    where store_id = _store_id and user_id = _user_id and active = true
  );
$$;

create or replace function public.is_store_admin(_store_id uuid, _user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.store_members
    where store_id = _store_id and user_id = _user_id and active = true
      and role in ('owner','admin')
  );
$$;

create or replace function public.store_is_public(_store_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.stores where id = _store_id and status in ('trial','active')
  );
$$;

-- auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ DROP OLD PROTOTYPE POLICIES ============
drop policy if exists categories_all_prototype on public.categories;
drop policy if exists products_all_prototype on public.products;
drop policy if exists product_images_all_prototype on public.product_images;
drop policy if exists product_options_all_prototype on public.product_options;
drop policy if exists product_option_values_all_prototype on public.product_option_values;
drop policy if exists product_variants_all_prototype on public.product_variants;

alter table public.product_images enable row level security;
alter table public.product_options enable row level security;
alter table public.product_option_values enable row level security;

-- ============ POLICIES ============

-- profiles
create policy "profiles_self_read" on public.profiles for select
  using (user_id = auth.uid() or public.is_platform_admin());
create policy "profiles_self_insert" on public.profiles for insert
  with check (user_id = auth.uid());
create policy "profiles_self_update" on public.profiles for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- plans
create policy "plans_public_read" on public.plans for select using (true);
create policy "plans_master_all" on public.plans for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- stores
create policy "stores_public_read" on public.stores for select using (
  status in ('trial','active') or public.is_store_member(id) or public.is_platform_admin()
);
create policy "stores_master_all" on public.stores for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "stores_admin_update" on public.stores for update
  using (public.is_store_admin(id)) with check (public.is_store_admin(id));

-- store_members
create policy "members_self_read" on public.store_members for select using (
  user_id = auth.uid() or public.is_store_admin(store_id) or public.is_platform_admin()
);
create policy "members_master_all" on public.store_members for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "members_admin_all" on public.store_members for all
  using (public.is_store_admin(store_id)) with check (public.is_store_admin(store_id));

-- platform_users
create policy "platform_self_read" on public.platform_users for select
  using (user_id = auth.uid() or public.is_platform_admin());
create policy "platform_master_all" on public.platform_users for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- subscriptions
create policy "subs_member_read" on public.subscriptions for select
  using (public.is_store_member(store_id) or public.is_platform_admin());
create policy "subs_master_all" on public.subscriptions for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- categories
create policy "cats_public_read" on public.categories for select
  using (store_id is not null and active and public.store_is_public(store_id));
create policy "cats_member_read" on public.categories for select
  using (public.is_store_member(store_id) or public.is_platform_admin());
create policy "cats_admin_all" on public.categories for all
  using (public.is_store_admin(store_id)) with check (public.is_store_admin(store_id));

-- products
create policy "products_public_read" on public.products for select
  using (store_id is not null and status = 'active' and public.store_is_public(store_id));
create policy "products_member_read" on public.products for select
  using (public.is_store_member(store_id) or public.is_platform_admin());
create policy "products_admin_all" on public.products for all
  using (public.is_store_admin(store_id)) with check (public.is_store_admin(store_id));

-- product_variants
create policy "variants_public_read" on public.product_variants for select using (
  exists(select 1 from public.products p
         where p.id = product_id and p.status = 'active' and public.store_is_public(p.store_id))
);
create policy "variants_member_read" on public.product_variants for select
  using (public.is_store_member(store_id) or public.is_platform_admin());
create policy "variants_admin_all" on public.product_variants for all
  using (public.is_store_admin(store_id)) with check (public.is_store_admin(store_id));

-- product_images
create policy "images_read" on public.product_images for select using (
  exists(select 1 from public.products p where p.id = product_id and (
    (p.status = 'active' and public.store_is_public(p.store_id))
    or public.is_store_member(p.store_id) or public.is_platform_admin()
  ))
);
create policy "images_admin_all" on public.product_images for all using (
  exists(select 1 from public.products p where p.id = product_id and public.is_store_admin(p.store_id))
) with check (
  exists(select 1 from public.products p where p.id = product_id and public.is_store_admin(p.store_id))
);

-- product_options
create policy "options_read" on public.product_options for select using (
  exists(select 1 from public.products p where p.id = product_id and (
    (p.status = 'active' and public.store_is_public(p.store_id))
    or public.is_store_member(p.store_id) or public.is_platform_admin()
  ))
);
create policy "options_admin_all" on public.product_options for all using (
  exists(select 1 from public.products p where p.id = product_id and public.is_store_admin(p.store_id))
) with check (
  exists(select 1 from public.products p where p.id = product_id and public.is_store_admin(p.store_id))
);

-- product_option_values
create policy "option_values_read" on public.product_option_values for select using (
  exists(select 1 from public.product_options o
         join public.products p on p.id = o.product_id
         where o.id = option_id and (
           (p.status = 'active' and public.store_is_public(p.store_id))
           or public.is_store_member(p.store_id) or public.is_platform_admin()
         ))
);
create policy "option_values_admin_all" on public.product_option_values for all using (
  exists(select 1 from public.product_options o
         join public.products p on p.id = o.product_id
         where o.id = option_id and public.is_store_admin(p.store_id))
) with check (
  exists(select 1 from public.product_options o
         join public.products p on p.id = o.product_id
         where o.id = option_id and public.is_store_admin(p.store_id))
);

-- customers / orders / order_items
create policy "customers_member_all" on public.customers for all
  using (public.is_store_member(store_id)) with check (public.is_store_member(store_id));
create policy "orders_member_all" on public.orders for all
  using (public.is_store_member(store_id)) with check (public.is_store_member(store_id));
create policy "order_items_member_all" on public.order_items for all
  using (public.is_store_member(store_id)) with check (public.is_store_member(store_id));

-- store_settings
create policy "settings_public_read" on public.store_settings for select
  using (public.store_is_public(store_id));
create policy "settings_admin_all" on public.store_settings for all
  using (public.is_store_admin(store_id)) with check (public.is_store_admin(store_id));

-- audit_logs
create policy "audit_read" on public.audit_logs for select
  using (public.is_platform_admin() or (store_id is not null and public.is_store_admin(store_id)));
create policy "audit_insert" on public.audit_logs for insert
  with check (actor_user_id = auth.uid() or public.is_platform_admin());

-- ============ updated_at triggers ============
create trigger t_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger t_plans_updated before update on public.plans for each row execute function public.set_updated_at();
create trigger t_stores_updated before update on public.stores for each row execute function public.set_updated_at();
create trigger t_members_updated before update on public.store_members for each row execute function public.set_updated_at();
create trigger t_platform_updated before update on public.platform_users for each row execute function public.set_updated_at();
create trigger t_subs_updated before update on public.subscriptions for each row execute function public.set_updated_at();
create trigger t_customers_updated before update on public.customers for each row execute function public.set_updated_at();
create trigger t_orders_updated before update on public.orders for each row execute function public.set_updated_at();
create trigger t_settings_updated before update on public.store_settings for each row execute function public.set_updated_at();

-- ============ SEEDS ============
insert into public.plans (name, description, max_products, max_users, allow_site_orders, allow_whatsapp_orders)
values
  ('Inicial', 'Até 50 produtos, catálogo público, pedidos pelo WhatsApp', 50, 1, false, true),
  ('Profissional', 'Até 300 produtos, pedidos pelo site e WhatsApp', 300, 3, true, true),
  ('Avançado', 'Até 1000 produtos, domínio próprio, múltiplos usuários', 1000, 10, true, true);

update public.plans set allow_custom_domain = true where name = 'Avançado';

insert into public.stores (name, slug, description, status, plan_id)
select 'VYNKA Demo', 'demo', 'Loja de demonstração da plataforma VYNKA', 'active', p.id
from public.plans p where p.name = 'Inicial' limit 1;

-- migrate existing rows to demo store
update public.categories set store_id = (select id from public.stores where slug = 'demo') where store_id is null;
update public.products   set store_id = (select id from public.stores where slug = 'demo') where store_id is null;
update public.product_variants pv
  set store_id = (select p.store_id from public.products p where p.id = pv.product_id)
  where store_id is null;

-- enforce NOT NULL
alter table public.categories       alter column store_id set not null;
alter table public.products         alter column store_id set not null;
alter table public.product_variants alter column store_id set not null;

-- indexes
create index if not exists idx_categories_store on public.categories(store_id);
create index if not exists idx_products_store on public.products(store_id);
create index if not exists idx_variants_store on public.product_variants(store_id);
create index if not exists idx_orders_store on public.orders(store_id);
create index if not exists idx_order_items_store on public.order_items(store_id);
create index if not exists idx_customers_store on public.customers(store_id);
create index if not exists idx_members_user on public.store_members(user_id);
create index if not exists idx_members_store on public.store_members(store_id);
