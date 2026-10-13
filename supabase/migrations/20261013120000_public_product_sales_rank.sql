-- Lote 3b do escopo catálogo/personalização: "Mais vendidos" no Ordenar da loja (§5; §13.2 decidido
-- por João em 13/10: conta só pedidos concluídos, status 'delivered', de qualquer origem).
-- O cliente da loja continua sem ler pedidos: a função devolve só a POSIÇÃO de cada produto no ranking
-- (1 = mais vendido), nunca a quantidade vendida nem dados do pedido. Só lojas publicadas e ativas,
-- só produtos ativos; produto sem venda concluída não aparece (a loja o põe depois dos que venderam).
-- Rollback: DROP FUNCTION public.public_product_sales_rank(uuid); (a tela sem a função cai em Novidades).

CREATE OR REPLACE FUNCTION public.public_product_sales_rank(p_store_id uuid)
RETURNS TABLE (product_id uuid, sales_rank integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ranked.product_id, ranked.sales_rank
  FROM (
    SELECT
      oi.product_id,
      (row_number() OVER (ORDER BY sum(oi.quantity) DESC, oi.product_id))::integer AS sales_rank
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    JOIN public.products p ON p.id = oi.product_id
    JOIN public.stores s ON s.id = o.store_id
    WHERE o.store_id = p_store_id
      AND oi.store_id = p_store_id
      AND p.store_id = p_store_id
      AND o.status = 'delivered'
      AND p.status = 'active'
      AND s.publication_status = 'published'
      AND s.status NOT IN ('suspended', 'cancelled')
    GROUP BY oi.product_id
  ) ranked
  ORDER BY ranked.sales_rank;
$$;

REVOKE ALL ON FUNCTION public.public_product_sales_rank(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_product_sales_rank(uuid) TO anon, authenticated;
