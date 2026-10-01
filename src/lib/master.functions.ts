import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PROVISIONAL_STORE_NAME, makeProvisionalSlug } from "@/lib/provisional-store";

/**
 * Provisiona o primeiro usuário Master a partir de MASTER_EMAIL / MASTER_PASSWORD.
 * Idempotente: se já existir, apenas garante o vínculo em platform_users.
 * Pública por design (executada uma vez pelo próprio operador da plataforma).
 */
export const bootstrapMaster = createServerFn({ method: "POST" }).handler(async () => {
  const email = process.env.MASTER_EMAIL || process.env.EMAIL_MASTER;
  const password = process.env.MASTER_PASSWORD || process.env.SENHA_MASTER;
  if (!email || !password) {
    throw new Error("Defina MASTER_EMAIL/MASTER_PASSWORD ou EMAIL_MASTER/SENHA_MASTER nos secrets antes de continuar.");
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // procura usuário pelo email
  let userId: string | null = null;
  const perPage = 200;
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) {
      userId = found.id;
      break;
    }
    if (data.users.length < perPage) break;
  }

  if (!userId) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "VYNKA Master" },
    });
    if (error) throw error;
    userId = data.user!.id;
  }

  const { data: existing } = await supabaseAdmin
    .from("platform_users")
    .select("id, active, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabaseAdmin
      .from("platform_users")
      .insert({ user_id: userId, role: "platform_owner", active: true });
    if (error) throw error;
  } else if (!existing.active) {
    await supabaseAdmin
      .from("platform_users")
      .update({ active: true, role: "platform_owner" })
      .eq("id", existing.id);
  }

  return { ok: true, email, userId, created: !existing };
});

/** Lista de lojas — somente Master. */
export const listStoresForMaster = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_platform_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { data, error } = await context.supabase
      .from("stores")
      .select("id, name, slug, email, whatsapp, status, plan_id, created_at, trial_ends_at, subscription_ends_at, plan:plans(name)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

/** Métricas do dashboard Master. */
export const masterStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_platform_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const [stores, products, orders] = await Promise.all([
      context.supabase.from("stores").select("status", { count: "exact" }),
      context.supabase.from("products").select("id", { count: "exact", head: true }),
      context.supabase.from("orders").select("id", { count: "exact", head: true }),
    ]);
    const byStatus = { trial: 0, active: 0, suspended: 0, cancelled: 0 };
    for (const s of stores.data ?? []) {
      const k = s.status as keyof typeof byStatus;
      if (k in byStatus) byStatus[k]++;
    }
    return {
      total_stores: (stores.data ?? []).length,
      by_status: byStatus,
      total_products: products.count ?? 0,
      total_orders: orders.count ?? 0,
    };
  });

const createStoreSchema = z.object({
  // Opcionais: sem eles a loja nasce com nome/link provisórios e o dono define depois.
  name: z.string().min(1).max(120).optional(),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hífen.")
    .optional(),
  owner_email: z.string().email(),
  // Opcional: o próprio responsável completa o cadastro ao abrir o convite.
  owner_name: z.string().max(120).optional(),
  whatsapp: z.string().optional().nullable(),
  plan_id: z.string().uuid(),
  redirect_origin: z.string().url().optional(),
});

// Origem do app (ex. https://vynka.lovable.app) para o link do convite abrir /reset-password.
// O Supabase só aceita destinos presentes em Authentication > URL Configuration.
function inviteRedirect(origin?: string) {
  return origin ? { redirectTo: `${new URL(origin).origin}/reset-password` } : {};
}

/** Cria uma nova loja + convida o responsável. Somente Master. */
export const createStoreWithOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createStoreSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_platform_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // slug informado: valida unicidade; sem slug: gera um provisório único
    let slug = data.slug;
    if (slug) {
      const { data: slugConflict } = await supabaseAdmin
        .from("stores").select("id").eq("slug", slug).maybeSingle();
      if (slugConflict) throw new Error(`O slug "${slug}" já está em uso.`);
    } else {
      for (let i = 0; i < 5 && !slug; i++) {
        const candidate = makeProvisionalSlug();
        const { data: taken } = await supabaseAdmin
          .from("stores").select("id").eq("slug", candidate).maybeSingle();
        if (!taken) slug = candidate;
      }
      if (!slug) throw new Error("Não foi possível gerar o link da loja. Tente novamente.");
    }

    // procura ou cria usuário
    let userId: string | null = null;
    let inviteLink: string | null = null;
    const perPage = 200;
    for (let page = 1; page <= 5; page++) {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      const found = list.users.find((u) => u.email?.toLowerCase() === data.owner_email.toLowerCase());
      if (found) { userId = found.id; break; }
      if (list.users.length < perPage) break;
    }

    if (!userId) {
      const link = await supabaseAdmin.auth.admin.generateLink({
        type: "invite",
        email: data.owner_email,
        options: {
          ...(data.owner_name ? { data: { full_name: data.owner_name } } : {}),
          ...inviteRedirect(data.redirect_origin),
        },
      });
      if (link.error) throw link.error;
      userId = link.data.user!.id;
      inviteLink = link.data.properties?.action_link ?? null;
    }

    // cria loja
    const { data: store, error: sErr } = await supabaseAdmin
      .from("stores")
      .insert({
        name: data.name ?? PROVISIONAL_STORE_NAME,
        slug,
        email: data.owner_email,
        responsible_name: data.owner_name ?? null,
        whatsapp: data.whatsapp ?? null,
        // Sem período de teste: a loja nasce ativa e o catálogo fica em rascunho até o dono publicar.
        status: "active",
        plan_id: data.plan_id,
      })
      .select("id")
      .single();
    if (sErr) throw sErr;

    await supabaseAdmin
      .from("store_members")
      .insert({ store_id: store.id, user_id: userId, role: "owner", active: true });

    await supabaseAdmin.from("subscriptions").insert({
      store_id: store.id,
      plan_id: data.plan_id,
      status: "active",
    });

    await supabaseAdmin.from("audit_logs").insert({
      actor_user_id: context.userId,
      actor_type: "master",
      store_id: store.id,
      action: "store.create",
      entity_type: "store",
      entity_id: store.id,
      metadata: { owner_email: data.owner_email, plan_id: data.plan_id },
    });

    return { ok: true, store_id: store.id, invite_link: inviteLink };
  });

/** Altera o status de uma loja. */
export const updateStoreStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      store_id: z.string().uuid(),
      status: z.enum(["trial", "active", "suspended", "cancelled"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_platform_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("stores").update({ status: data.status }).eq("id", data.store_id);
    if (error) throw error;
    await supabaseAdmin.from("audit_logs").insert({
      actor_user_id: context.userId,
      actor_type: "master",
      store_id: data.store_id,
      action: `store.status.${data.status}`,
      entity_type: "store",
      entity_id: data.store_id,
    });
    return { ok: true };
  });

/** Troca o plano de uma loja (e da assinatura dela). Somente Master. */
export const updateStorePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ store_id: z.string().uuid(), plan_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_platform_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("stores").update({ plan_id: data.plan_id }).eq("id", data.store_id);
    if (error) throw error;
    const { error: subErr } = await supabaseAdmin
      .from("subscriptions").update({ plan_id: data.plan_id }).eq("store_id", data.store_id);
    if (subErr) throw subErr;
    await supabaseAdmin.from("audit_logs").insert({
      actor_user_id: context.userId,
      actor_type: "master",
      store_id: data.store_id,
      action: "store.plan.update",
      entity_type: "store",
      entity_id: data.store_id,
      metadata: { plan_id: data.plan_id },
    });
    return { ok: true };
  });

/**
 * Gera um novo link de acesso para o dono da loja. Quem nunca entrou recebe um convite;
 * quem já entrou recebe um link de redefinição de senha. Os dois abrem /reset-password.
 * Somente Master.
 */
export const resendStoreInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ store_id: z.string().uuid(), redirect_origin: z.string().url().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_platform_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: owner, error: ownerErr } = await supabaseAdmin
      .from("store_members")
      .select("user_id")
      .eq("store_id", data.store_id)
      .eq("role", "owner")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (ownerErr) throw ownerErr;
    if (!owner) throw new Error("Esta loja não tem responsável vinculado.");

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.admin.getUserById(owner.user_id);
    if (userErr) throw userErr;
    const email = userRes.user.email;
    if (!email) throw new Error("O responsável desta loja não tem e-mail cadastrado.");

    const type = userRes.user.last_sign_in_at ? "recovery" : "invite";
    const link = await supabaseAdmin.auth.admin.generateLink({
      type,
      email,
      options: inviteRedirect(data.redirect_origin),
    });
    if (link.error) throw link.error;

    await supabaseAdmin.from("audit_logs").insert({
      actor_user_id: context.userId,
      actor_type: "master",
      store_id: data.store_id,
      action: "store.invite.resend",
      entity_type: "store",
      entity_id: data.store_id,
      metadata: { owner_email: email, link_type: type },
    });
    return { ok: true, invite_link: link.data.properties?.action_link ?? null, link_type: type };
  });

export const listPlans =createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("plans").select("*").order("max_products");
    return data ?? [];
  });

export const listSubscriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_platform_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { data } = await context.supabase
      .from("subscriptions")
      .select("*, store:stores(name,slug), plan:plans(name)")
      .order("created_at", { ascending: false });
    return data ?? [];
  });
