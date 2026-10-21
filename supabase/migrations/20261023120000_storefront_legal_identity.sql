-- Páginas legais, lote L1 (escopo paginas-legais.md, §1.3 e §6): a loja mostra a identificação exigida
-- pelo Decreto 7.962/2013 (nome, CPF ou CNPJ, endereço, contato). A visão pública passa a entregar o
-- documento cadastrado e, só quando é CPF (pessoa física), o nome do responsável (João, 20/10).
-- Continua fora da visão: plano, datas da assinatura e demais colunas internas.
--
-- Rollback: _snapshots/2026-10-20-paginas-legais/ROLLBACK.md (fora do repo).

CREATE OR REPLACE VIEW public.storefront_stores
WITH (security_barrier = true) AS
  SELECT id, slug, name, description, logo_url, banner_url, og_image_url, banner_title,
         banner_subtitle, banner_cta, phone, whatsapp, email, instagram, address, address_number,
         complement, city, state, zip_code, business_hours, status, publication_status,
         nullif(trim(tax_document), '') AS tax_document,
         CASE WHEN length(regexp_replace(coalesce(tax_document, ''), '\D', '', 'g')) = 11
              THEN nullif(trim(responsible_name), '') END AS responsible_name
  FROM public.stores
  WHERE publication_status = 'published';

REVOKE ALL ON public.storefront_stores FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.storefront_stores TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
