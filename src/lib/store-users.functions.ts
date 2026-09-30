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

async function assertCanManageStoreUsers(
  context: { supabase: any; userId: string },
  storeId: string,
) {
  const [{ data: isStoreAdmin }, { data: isPlatformAdmin }] = await Promise.all([
    context.supabase.rpc("is_store_admin", { _store_id: storeId, _user_id: context.userId }),
    context.supabase.rpc("is_platform_admin", { _user_id: context.userId }),
  ]);
  if (!isStoreAdmin && !isPlatformAdmin) throw new Error("Forbidden");
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

    const authUpdate: {
      email: string;
      email_confirm: true;
      user_metadata: { full_name: string };
      password?: string;
    } = {
      email: data.email.trim().toLowerCase(),
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
