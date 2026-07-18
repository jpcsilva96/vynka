
-- Read (signed URL / listing): open — branding assets are meant to be shown publicly
CREATE POLICY "store_branding_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'store-branding');

-- Write scoped to store admins by first path segment = store_id
CREATE POLICY "store_branding_admin_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'store-branding'
    AND public.is_store_admin((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "store_branding_admin_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'store-branding'
    AND public.is_store_admin((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "store_branding_admin_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'store-branding'
    AND public.is_store_admin((storage.foldername(name))[1]::uuid)
  );
