-- CPF do cliente sem troca pela conta do cliente (João, 11/11): o CPF entra no cadastro (servidor)
-- ou, em conta antiga, no primeiro checkout (servidor). A conta do cliente não muda o `document` da
-- própria ficha nem chamando a API direto. Lojista/membro e master continuam podendo corrigir.
-- Só acrescenta `document` à trava de 20261022120000_storefront_permissions_p1.sql.

CREATE OR REPLACE FUNCTION public.customers_guard_self_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND OLD.user_id = auth.uid()
     AND NOT public.is_store_member(OLD.store_id) AND NOT public.is_platform_admin() AND (
       NEW.email IS DISTINCT FROM OLD.email
    OR NEW.store_login IS DISTINCT FROM OLD.store_login
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.store_id IS DISTINCT FROM OLD.store_id
    OR NEW.notes IS DISTINCT FROM OLD.notes
    OR NEW.document IS DISTINCT FROM OLD.document
  ) THEN
    RAISE EXCEPTION 'Campo da ficha não pode ser alterado pela conta do cliente.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
