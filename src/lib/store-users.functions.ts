import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const permissionsSchema = z.object({
  view_all_transactions: z.boolean().default(false),
  discount_sales: z.boolean().default(false),
  manage_products: z.boolean().default(false),
  manage_stock: z.boolean().default(false),
});

const createStoreUserSchema = z.object({
  store_id: z.string().uuid(),
  name: z.string().min(1, "Informe o nome.").max(120),
  email: z.string().email("Informe um e-mail valido."),
  password: z.string().min(6, "A senha precisa ter ao menos 6 caracteres."),
  administrator: z.boolean().default(false),
  permissions: permissionsSchema,
});

const updateStoreUserSchema = z.object({
  store_id: z.string().uuid(),
  member_id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string().min(1, "Informe o nome.").max(120),
  email: z.string().email("Informe um e-mail valido."),
  password: z.string().optional().default(""),
  administrator: z.boolean().default(false),
  permissions: permissionsSchema,
});

// Usuários da loja: só o dono (e o master). Administrador e vendedor ficam de fora, senão um
// administrador trocaria o e-mail e a senha do dono e assumiria a conta.
async function assertCanManageStoreUsers(
  context: { supabase: any; userId: string },
  storeId: string,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: ownerRow, error: ownerError }, { data: isPlatformAdmin }] = await Promise.all([
    supabaseAdmin
      .from("store_members")
      .select("id")
      .eq("store_id", storeId)
      .eq("user_id", context.userId)
      .eq("role", "owner")
      .eq("active", true)
      .maybeSingle(),
    context.supabase.rpc("is_platform_admin", { _user_id: context.userId }),
  ]);
  if (ownerError) throw ownerError;
  if (!ownerRow && !isPlatformAdmin) throw new Error("Forbidden");
}

/**
 * E-mail e senha de outra pessoa só mudam se a conta for só desta loja. Conta que também é de outra
 * loja, do master ou de cliente fica intocada: senão o dono de uma loja cadastraria o e-mail do dono
 * de outra como vendedor e trocaria a senha dele.
 */
async function loginBelongsOnlyToStore(userId: string, storeId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [members, platform, authUser] = await Promise.all([
    supabaseAdmin
      .from("store_members")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .neq("store_id", storeId),
    supabaseAdmin.from("platform_users").select("id").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.auth.admin.getUserById(userId),
  ]);
  if (members.error) throw members.error;
  if (platform.error) throw platform.error;
  if (authUser.error) throw authUser.error;
  const isCustomer = authUser.data.user?.app_metadata?.role === "customer";
  return (members.count ?? 0) === 0 && !platform.data && !isCustomer;
}

export const listStoreUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ store_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertCanManageStoreUsers(context, data.store_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: members, error: membersError }, { data: orders, error: ordersError }] =
      await Promise.all([
        supabaseAdmin
          .from("store_members")
          .select("id, user_id, role, active, name, email, permissions, created_at")
          .eq("store_id", data.store_id)
          .eq("active", true)
          .order("created_at", { ascending: true }),
        supabaseAdmin
          .from("orders")
          .select("created_by,total,status,payment_details")
          .eq("store_id", data.store_id),
      ]);
    if (membersError) throw membersError;
    if (ordersError) throw ordersError;

    const users = await Promise.all(
      (members ?? []).map(async (member: any) => {
        const authUser = await supabaseAdmin.auth.admin.getUserById(member.user_id);
        const user = authUser.data?.user;
        const sales = (orders ?? []).filter(
          (order: any) =>
            order.created_by === member.user_id &&
            order.status === "delivered" &&
            order.payment_details?.cancelled_from !== "sale_history",
        );
        return {
          id: member.id,
          user_id: member.user_id,
          name:
            member.name ||
            user?.user_metadata?.full_name ||
            user?.user_metadata?.name ||
            user?.email?.split("@")[0] ||
            "Usuario",
          email: member.email || user?.email || null,
          role: member.role,
          active: member.active,
          permissions: member.permissions ?? {},
          revenue: sales.reduce((sum: number, order: any) => sum + Number(order.total ?? 0), 0),
          sales_count: sales.length,
        };
      }),
    );

    const totalRevenue = users.reduce((sum, user) => sum + user.revenue, 0);
    return users.map((user) => ({
      ...user,
      share: totalRevenue ? (user.revenue / totalRevenue) * 100 : 0,
    }));
  });

export const createStoreUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createStoreUserSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertCanManageStoreUsers(context, data.store_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = data.email.trim().toLowerCase();
    let userId: string | null = null;
    const perPage = 200;
    for (let page = 1; page <= 10; page++) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (error) throw error;
      const found = list.users.find((user) => user.email?.toLowerCase() === email);
      if (found) {
        userId = found.id;
        break;
      }
      if (list.users.length < perPage) break;
    }

    const userAlreadyExisted = !!userId;

    if (userId) {
      const [{ data: existingMember, error: existingError }, authUser] = await Promise.all([
        supabaseAdmin
          .from("store_members")
          .select("role")
          .eq("store_id", data.store_id)
          .eq("user_id", userId)
          .maybeSingle(),
        supabaseAdmin.auth.admin.getUserById(userId),
      ]);
      if (existingError) throw existingError;
      if (authUser.error) throw authUser.error;
      // O upsert abaixo rebaixaria o dono a vendedor.
      if (existingMember?.role === "owner") throw new Error("Este e-mail é do dono da loja.");
      if (authUser.data.user?.app_metadata?.role === "customer") {
        throw new Error("Este e-mail é de uma conta de cliente. Use outro e-mail para o usuário.");
      }
    }

    if (!userId) {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: data.name.trim() },
      });
      if (error) throw error;
      userId = created.user!.id;
    }

    const role = data.administrator ? "admin" : "seller";
    const { error: memberError } = await supabaseAdmin.from("store_members").upsert(
      {
        store_id: data.store_id,
        user_id: userId,
        role,
        active: true,
        name: data.name.trim(),
        email,
        permissions: data.permissions,
      },
      { onConflict: "store_id,user_id" },
    );
    if (memberError) throw memberError;

    return { ok: true, user_id: userId, existing_user: userAlreadyExisted };
  });

export const updateStoreUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateStoreUserSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertCanManageStoreUsers(context, data.store_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: member, error: memberLookupError } = await supabaseAdmin
      .from("store_members")
      .select("id, role, user_id")
      .eq("id", data.member_id)
      .eq("store_id", data.store_id)
      .maybeSingle();
    if (memberLookupError) throw memberLookupError;
    if (!member || member.user_id !== data.user_id) throw new Error("Usuario nao encontrado.");

    const email = data.email.trim().toLowerCase();
    const { data: current, error: currentError } = await supabaseAdmin.auth.admin.getUserById(
      data.user_id,
    );
    if (currentError) throw currentError;
    const loginChanged =
      email !== (current.user?.email ?? "").toLowerCase() || !!data.password.trim();
    const canEditLogin =
      data.user_id === context.userId ||
      (await loginBelongsOnlyToStore(data.user_id, data.store_id));
    if (loginChanged && !canEditLogin) {
      throw new Error(
        "Esta conta também é usada fora desta loja. Só a própria pessoa pode trocar o e-mail e a senha.",
      );
    }

    if (canEditLogin) {
      const authUpdate: {
        email: string;
        email_confirm: true;
        user_metadata: { full_name: string };
        password?: string;
      } = {
        email,
        email_confirm: true,
        user_metadata: { full_name: data.name.trim() },
      };
      if (data.password.trim()) {
        if (data.password.trim().length < 6) {
          throw new Error("A senha precisa ter ao menos 6 caracteres.");
        }
        authUpdate.password = data.password.trim();
      }

      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        data.user_id,
        authUpdate,
      );
      if (authError) throw authError;
    }

    const role = member.role === "owner" ? "owner" : data.administrator ? "admin" : "seller";
    const { error: updateError } = await supabaseAdmin
      .from("store_members")
      .update({
        role,
        name: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        permissions: data.permissions,
      })
      .eq("id", data.member_id)
      .eq("store_id", data.store_id);
    if (updateError) throw updateError;

    return { ok: true };
  });
