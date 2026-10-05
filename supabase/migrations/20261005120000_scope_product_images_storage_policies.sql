-- Storage product-images: escrita só para admin da loja dona da pasta ({store_id}/arquivo) ou master.
-- Antes: INSERT/UPDATE/DELETE abertos a qualquer um (inclusive anônimo), checando só o bucket.
-- Leitura pública (product_images_public_read) não muda: o catálogo continua exibindo as imagens.
-- O regex evita erro de cast quando a primeira pasta não é um uuid (arquivos antigos na raiz).

drop policy if exists "product_images_public_write" on storage.objects;
drop policy if exists "product_images_public_update" on storage.objects;
drop policy if exists "product_images_public_delete" on storage.objects;

drop policy if exists "product_images_admin_insert" on storage.objects;
create policy "product_images_admin_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and (
      public.is_platform_admin()
      or case
        when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then public.is_store_admin(((storage.foldername(name))[1])::uuid)
        else false
      end
    )
  );

drop policy if exists "product_images_admin_update" on storage.objects;
create policy "product_images_admin_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'product-images'
    and (
      public.is_platform_admin()
      or case
        when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then public.is_store_admin(((storage.foldername(name))[1])::uuid)
        else false
      end
    )
  );

drop policy if exists "product_images_admin_delete" on storage.objects;
create policy "product_images_admin_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'product-images'
    and (
      public.is_platform_admin()
      or case
        when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then public.is_store_admin(((storage.foldername(name))[1])::uuid)
        else false
      end
    )
  );
