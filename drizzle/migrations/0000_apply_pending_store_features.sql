ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'paid';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'in_production';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'in_dispatch';

DROP POLICY IF EXISTS "cats_admin_all" ON public.categories;
CREATE POLICY "cats_admin_all" ON public.categories FOR ALL
  USING (public.is_store_admin(store_id) OR public.is_platform_admin())
  WITH CHECK (public.is_store_admin(store_id) OR public.is_platform_admin());
DROP POLICY IF EXISTS "products_admin_all" ON public.products;
CREATE POLICY "products_admin_all" ON public.products FOR ALL
  USING (public.is_store_admin(store_id) OR public.is_platform_admin())
  WITH CHECK (public.is_store_admin(store_id) OR public.is_platform_admin());
DROP POLICY IF EXISTS "variants_admin_all" ON public.product_variants;
CREATE POLICY "variants_admin_all" ON public.product_variants FOR ALL
  USING (public.is_store_admin(store_id) OR public.is_platform_admin())
  WITH CHECK (public.is_store_admin(store_id) OR public.is_platform_admin());
DROP POLICY IF EXISTS "images_admin_all" ON public.product_images;
CREATE POLICY "images_admin_all" ON public.product_images FOR ALL
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND (public.is_store_admin(p.store_id) OR public.is_platform_admin())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND (public.is_store_admin(p.store_id) OR public.is_platform_admin())));
DROP POLICY IF EXISTS "options_admin_all" ON public.product_options;
CREATE POLICY "options_admin_all" ON public.product_options FOR ALL
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND (public.is_store_admin(p.store_id) OR public.is_platform_admin())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND (public.is_store_admin(p.store_id) OR public.is_platform_admin())));
DROP POLICY IF EXISTS "option_values_admin_all" ON public.product_option_values;
CREATE POLICY "option_values_admin_all" ON public.product_option_values FOR ALL
  USING (EXISTS (SELECT 1 FROM public.product_options o JOIN public.products p ON p.id = o.product_id WHERE o.id = option_id AND (public.is_store_admin(p.store_id) OR public.is_platform_admin())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.product_options o JOIN public.products p ON p.id = o.product_id WHERE o.id = option_id AND (public.is_store_admin(p.store_id) OR public.is_platform_admin())));
DROP POLICY IF EXISTS "customers_member_all" ON public.customers;
CREATE POLICY "customers_member_all" ON public.customers FOR ALL
  USING (public.is_store_member(store_id) OR public.is_platform_admin())
  WITH CHECK (public.is_store_member(store_id) OR public.is_platform_admin());
DROP POLICY IF EXISTS "orders_member_all" ON public.orders;
CREATE POLICY "orders_member_all" ON public.orders FOR ALL
  USING (public.is_store_member(store_id) OR public.is_platform_admin())
  WITH CHECK (public.is_store_member(store_id) OR public.is_platform_admin());
DROP POLICY IF EXISTS "order_items_member_all" ON public.order_items;
CREATE POLICY "order_items_member_all" ON public.order_items FOR ALL
  USING (public.is_store_member(store_id) OR public.is_platform_admin())
  WITH CHECK (public.is_store_member(store_id) OR public.is_platform_admin());
DROP POLICY IF EXISTS "settings_admin_all" ON public.store_settings;
CREATE POLICY "settings_admin_all" ON public.store_settings FOR ALL
  USING (public.is_store_admin(store_id) OR public.is_platform_admin())
  WITH CHECK (public.is_store_admin(store_id) OR public.is_platform_admin());
DROP POLICY IF EXISTS "store_branding_admin_insert" ON storage.objects;
CREATE POLICY "store_branding_admin_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'store-branding' AND (public.is_platform_admin() OR public.is_store_admin((storage.foldername(name))[1]::uuid)));
DROP POLICY IF EXISTS "store_branding_admin_update" ON storage.objects;
CREATE POLICY "store_branding_admin_update" ON storage.objects FOR UPDATE USING (
  bucket_id = 'store-branding' AND (public.is_platform_admin() OR public.is_store_admin((storage.foldername(name))[1]::uuid)));
DROP POLICY IF EXISTS "store_branding_admin_delete" ON storage.objects;
CREATE POLICY "store_branding_admin_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'store-branding' AND (public.is_platform_admin() OR public.is_store_admin((storage.foldername(name))[1]::uuid)));

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS manage_stock boolean NOT NULL DEFAULT false;
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS stock_quantity integer NOT NULL DEFAULT 0;
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS document text, ADD COLUMN IF NOT EXISTS notes text, ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS mobile text, ADD COLUMN IF NOT EXISTS telephone text, ADD COLUMN IF NOT EXISTS zip_code text,
  ADD COLUMN IF NOT EXISTS street text, ADD COLUMN IF NOT EXISTS address_number text, ADD COLUMN IF NOT EXISTS complement text,
  ADD COLUMN IF NOT EXISTS neighborhood text, ADD COLUMN IF NOT EXISTS city text, ADD COLUMN IF NOT EXISTS state text;
alter table public.products add column if not exists cost_price numeric not null default 0;
alter table public.order_items
  add column if not exists unit_cost numeric not null default 0,
  add column if not exists total_cost numeric not null default 0;
update public.order_items oi set unit_cost = coalesce(p.cost_price, 0), total_cost = oi.quantity * coalesce(p.cost_price, 0)
from public.products p where oi.product_id = p.id and (oi.unit_cost = 0 or oi.total_cost = 0);
alter table public.store_members
  add column if not exists name text, add column if not exists email text,
  add column if not exists permissions jsonb not null default '{}'::jsonb;
create index if not exists idx_store_members_email on public.store_members(email);
alter table public.stores add column if not exists responsible_name text, add column if not exists tax_document text;
alter table public.categories add column if not exists parent_id uuid references public.categories(id) on delete restrict;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'categories_parent_not_self' and conrelid = 'public.categories'::regclass) then
    alter table public.categories add constraint categories_parent_not_self check (parent_id is null or parent_id <> id);
  end if;
end $$;
create index if not exists idx_categories_parent on public.categories(parent_id);
create index if not exists idx_categories_store_parent_order on public.categories(store_id, parent_id, display_order);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'categories_store_slug_unique' and conrelid = 'public.categories'::regclass) then
    alter table public.categories add constraint categories_store_slug_unique unique (store_id, slug);
  end if;
end $$;

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS customers_store_user_unique ON public.customers(store_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers(user_id);
CREATE TABLE IF NOT EXISTS public.customer_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, user_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_favorites TO authenticated;
GRANT ALL ON public.customer_favorites TO service_role;
ALTER TABLE public.customer_favorites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "customers_client_self_read" ON public.customers;
CREATE POLICY "customers_client_self_read" ON public.customers FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "customers_client_self_insert" ON public.customers;
CREATE POLICY "customers_client_self_insert" ON public.customers FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "customers_client_self_update" ON public.customers;
CREATE POLICY "customers_client_self_update" ON public.customers FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "orders_client_self_read" ON public.orders;
CREATE POLICY "orders_client_self_read" ON public.orders FOR SELECT USING (
  customer_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND c.user_id = auth.uid() AND c.store_id = orders.store_id));
DROP POLICY IF EXISTS "orders_client_self_insert" ON public.orders;
CREATE POLICY "orders_client_self_insert" ON public.orders FOR INSERT WITH CHECK (
  customer_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND c.user_id = auth.uid() AND c.store_id = orders.store_id));
DROP POLICY IF EXISTS "order_items_client_self_read" ON public.order_items;
CREATE POLICY "order_items_client_self_read" ON public.order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.orders o JOIN public.customers c ON c.id = o.customer_id
    WHERE o.id = order_items.order_id AND o.store_id = order_items.store_id AND c.user_id = auth.uid()));
DROP POLICY IF EXISTS "order_items_client_self_insert" ON public.order_items;
CREATE POLICY "order_items_client_self_insert" ON public.order_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.orders o JOIN public.customers c ON c.id = o.customer_id
    WHERE o.id = order_items.order_id AND o.store_id = order_items.store_id AND c.user_id = auth.uid()));
DROP POLICY IF EXISTS "favorites_client_all" ON public.customer_favorites;
CREATE POLICY "favorites_client_all" ON public.customer_favorites FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.customers c
    WHERE c.id = customer_id AND c.user_id = auth.uid() AND c.store_id = customer_favorites.store_id));

alter table public.stores add column if not exists address_number text, add column if not exists complement text;

CREATE TABLE IF NOT EXISTS public.store_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  title text, subtitle text, button_label text,
  link_type text NOT NULL DEFAULT 'home',
  link_target text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_banners_link_type_check CHECK (link_type IN ('home','store_home','product','category','external'))
);
CREATE INDEX IF NOT EXISTS store_banners_store_order_idx ON public.store_banners (store_id, sort_order, created_at);
GRANT SELECT ON public.store_banners TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.store_banners TO authenticated;
GRANT ALL ON public.store_banners TO service_role;
ALTER TABLE public.store_banners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "store_banners_public_read" ON public.store_banners;
CREATE POLICY "store_banners_public_read" ON public.store_banners FOR SELECT USING (
  active = true AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.status IN ('trial','active') AND s.publication_status = 'published'));
DROP POLICY IF EXISTS "store_banners_admin_all" ON public.store_banners;
CREATE POLICY "store_banners_admin_all" ON public.store_banners FOR ALL
  USING (public.is_store_admin(store_id) OR public.is_platform_admin())
  WITH CHECK (public.is_store_admin(store_id) OR public.is_platform_admin());
DROP TRIGGER IF EXISTS t_store_banners_updated ON public.store_banners;
CREATE TRIGGER t_store_banners_updated BEFORE UPDATE ON public.store_banners FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.store_banners (store_id, image_url, title, subtitle, button_label, link_type, sort_order, active)
SELECT id, banner_url, banner_title, banner_subtitle, COALESCE(NULLIF(banner_cta, ''), 'Ver produtos'), 'home', 0, true
FROM public.stores
WHERE banner_url IS NOT NULL AND banner_url <> ''
  AND NOT EXISTS (SELECT 1 FROM public.store_banners b WHERE b.store_id = stores.id);