-- Endereços do cliente (lote 5a) sem permissão para visitante sem login (anon).
-- O Supabase dá todas as permissões ao anon em tabela nova; as regras de acesso já barravam
-- (0 linhas), mas nenhuma tela usa endereço sem login, então a permissão sai.
-- Rollback: GRANT ALL ON public.customer_addresses TO anon;
REVOKE ALL ON public.customer_addresses FROM anon;
