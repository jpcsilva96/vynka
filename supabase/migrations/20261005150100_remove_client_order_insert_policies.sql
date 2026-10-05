-- Etapa 2 de 2: o cliente deixa de gravar pedido direto; a única porta é create_store_order.
-- Rodar SÓ depois que a tela nova do checkout estiver publicada.
DROP POLICY IF EXISTS "orders_client_self_insert" ON public.orders;
DROP POLICY IF EXISTS "order_items_client_self_insert" ON public.order_items;
