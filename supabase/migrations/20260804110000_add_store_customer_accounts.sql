ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customers_store_user_unique
  ON public.customers(store_id, user_id)
  WHERE user_id IS NOT NULL;

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
CREATE POLICY "customers_client_self_read" ON public.customers FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "customers_client_self_insert" ON public.customers;
CREATE POLICY "customers_client_self_insert" ON public.customers FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "customers_client_self_update" ON public.customers;
CREATE POLICY "customers_client_self_update" ON public.customers FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "orders_client_self_read" ON public.orders;
CREATE POLICY "orders_client_self_read" ON public.orders FOR SELECT
  USING (
    customer_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = customer_id AND c.user_id = auth.uid() AND c.store_id = orders.store_id
    )
  );

DROP POLICY IF EXISTS "orders_client_self_insert" ON public.orders;
CREATE POLICY "orders_client_self_insert" ON public.orders FOR INSERT
  WITH CHECK (
    customer_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = customer_id AND c.user_id = auth.uid() AND c.store_id = orders.store_id
    )
  );

DROP POLICY IF EXISTS "order_items_client_self_read" ON public.order_items;
CREATE POLICY "order_items_client_self_read" ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.customers c ON c.id = o.customer_id
      WHERE o.id = order_items.order_id
        AND o.store_id = order_items.store_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "order_items_client_self_insert" ON public.order_items;
CREATE POLICY "order_items_client_self_insert" ON public.order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.customers c ON c.id = o.customer_id
      WHERE o.id = order_items.order_id
        AND o.store_id = order_items.store_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "favorites_client_all" ON public.customer_favorites;
CREATE POLICY "favorites_client_all" ON public.customer_favorites FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = customer_id AND c.user_id = auth.uid() AND c.store_id = customer_favorites.store_id
    )
  );
