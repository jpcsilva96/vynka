-- Dívida técnica, lote B: o servidor achava conta por e-mail (e e-mail/último acesso por id)
-- varrendo auth.admin.listUsers de 200 em 200 até 1.000-2.000 contas. Como cada cliente da loja vira
-- uma conta, o teto chegaria com as vendas (convite de lojista falharia; lista do master erraria).
-- Duas funções leem auth.users direto, só para o servidor (service_role); ninguém logado as chama.
-- Não muda tabela nem regra existente.
--
-- Rollback: _snapshots/2026-11-01-lote-b-contas/ROLLBACK.md (fora do repo).

CREATE OR REPLACE FUNCTION public.admin_auth_user_id_by_email(_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.id
  FROM auth.users u
  WHERE lower(u.email) = lower(trim(_email))
  ORDER BY u.is_sso_user, u.created_at
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.admin_auth_users_by_ids(_ids uuid[])
RETURNS TABLE (id uuid, email text, last_sign_in_at timestamptz, signup_completed boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.id,
         u.email::text,
         u.last_sign_in_at,
         coalesce(u.raw_user_meta_data -> 'signup_completed' = 'true'::jsonb, false)
  FROM auth.users u
  WHERE u.id = ANY (_ids)
$$;

REVOKE ALL ON FUNCTION public.admin_auth_user_id_by_email(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_auth_users_by_ids(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_auth_user_id_by_email(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_auth_users_by_ids(uuid[]) TO service_role;

NOTIFY pgrst, 'reload schema';
