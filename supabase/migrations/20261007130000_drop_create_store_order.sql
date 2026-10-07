-- Lote C, passo final: o pedido do site passou a ser criado só pelo servidor
-- (create_checkout_order, 20261007120000), com frete e entrega conferidos. A função antiga, que o
-- navegador chamava direto sem entrega, não é mais usada pela tela publicada (PR #41) e sai, para
-- não sobrar caminho de pedido sem frete.
-- Rollback: recriar a função de 20261005150000_create_store_order_function.sql (com os grants).

DROP FUNCTION IF EXISTS public.create_store_order(uuid, jsonb, text, jsonb);
