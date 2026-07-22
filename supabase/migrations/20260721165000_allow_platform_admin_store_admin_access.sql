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
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id
        AND (public.is_store_admin(p.store_id) OR public.is_platform_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id
        AND (public.is_store_admin(p.store_id) OR public.is_platform_admin())
    )
  );

DROP POLICY IF EXISTS "options_admin_all" ON public.product_options;
CREATE POLICY "options_admin_all" ON public.product_options FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id
        AND (public.is_store_admin(p.store_id) OR public.is_platform_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id
        AND (public.is_store_admin(p.store_id) OR public.is_platform_admin())
    )
  );

DROP POLICY IF EXISTS "option_values_admin_all" ON public.product_option_values;
CREATE POLICY "option_values_admin_all" ON public.product_option_values FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.product_options o
      JOIN public.products p ON p.id = o.product_id
      WHERE o.id = option_id
        AND (public.is_store_admin(p.store_id) OR public.is_platform_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.product_options o
      JOIN public.products p ON p.id = o.product_id
      WHERE o.id = option_id
        AND (public.is_store_admin(p.store_id) OR public.is_platform_admin())
    )
  );

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
CREATE POLICY "store_branding_admin_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'store-branding'
    AND (
      public.is_platform_admin()
      OR public.is_store_admin((storage.foldername(name))[1]::uuid)
    )
  );

DROP POLICY IF EXISTS "store_branding_admin_update" ON storage.objects;
CREATE POLICY "store_branding_admin_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'store-branding'
    AND (
      public.is_platform_admin()
      OR public.is_store_admin((storage.foldername(name))[1]::uuid)
    )
  );

DROP POLICY IF EXISTS "store_branding_admin_delete" ON storage.objects;
CREATE POLICY "store_branding_admin_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'store-branding'
    AND (
      public.is_platform_admin()
      OR public.is_store_admin((storage.foldername(name))[1]::uuid)
    )
  );
