// Busca de contas do Auth pelo servidor (lote B): funções do banco só para service_role
// (migration 20261101120000) no lugar de varrer auth.admin.listUsers de 200 em 200, que tinha teto
// de 1.000-2.000 contas e cada cliente da loja vira uma conta.

export type AuthUserSummary = {
  email: string | null;
  last_sign_in_at: string | null;
  signup_completed: boolean;
};

export async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any).rpc("admin_auth_user_id_by_email", {
    _email: email,
  });
  if (error) throw error;
  return (data as string | null) ?? null;
}

export async function getAuthUsersByIds(ids: string[]): Promise<Map<string, AuthUserSummary>> {
  const result = new Map<string, AuthUserSummary>();
  if (ids.length === 0) return result;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any).rpc("admin_auth_users_by_ids", {
    _ids: [...new Set(ids)],
  });
  if (error) throw error;
  for (const row of (data ?? []) as ({ id: string } & AuthUserSummary)[]) {
    result.set(row.id, {
      email: row.email ?? null,
      last_sign_in_at: row.last_sign_in_at ?? null,
      signup_completed: row.signup_completed === true,
    });
  }
  return result;
}
