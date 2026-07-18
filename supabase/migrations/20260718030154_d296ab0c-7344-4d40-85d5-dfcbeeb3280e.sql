
DROP POLICY IF EXISTS stores_public_read ON public.stores;
CREATE POLICY stores_public_read ON public.stores
  FOR SELECT USING (
    status IN ('trial','active')
    OR is_store_member(id)
    OR is_platform_admin()
  );
