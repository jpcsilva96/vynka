import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  PROVISIONAL_STORE_NAME,
  isProvisionalName,
  makeProvisionalSlug,
} from "@/lib/provisional-store";

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

/**
 * Status exibido ao Master (o banco guarda só trial/active/suspended/cancelled):
 * - "invited": loja no ar cujo dono ainda não concluiu o cadastro em /boas-vindas;
 * - "active": loja no ar com cadastro concluído (trial antigo conta como ativa);
 * - "suspended": suspensa (cancelled = antigo "Arquivada", tratado como suspensa).
 */
export type StoreDisplayStatus = "invited" | "active" | "suspended";

async function storeDisplayStatuses(stores: { id: string; name: string; status: string }[]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const result = new Map<string, StoreDisplayStatus>();
  const open = stores.filter((s) => s.status === "active" || s.status === "trial");
  for (const s of stores) if (!open.includes(s)) result.set(s.id, "suspended");
  if (open.length === 0) return result;

  const { data: owners, error } = await supabaseAdmin
    .from("store_members")
    .select("store_id, user_id")
    .eq("role", "owner")
    .in("store_id", open.map((s) => s.id));
  if (error) throw error;

  // Um listUsers paginado em vez de um getUserById por loja.
  const signupDone = new Set<string>();
  const perPage = 200;
  for (let page = 1; page <= 10; page++) {
    const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (listErr) throw listErr;
    for (const u of list.users) if (u.user_metadata?.signup_completed === true) signupDone.add(u.id);
    if (list.users.length < perPage) break;
  }

  for (const s of open) {
    const ownerIds = (owners ?? []).filter((o) => o.store_id === s.id).map((o) => o.user_id as string);
    const done = !isProvisionalName(s.name) || ownerIds.some((id) => signupDone.has(id));
    result.set(s.id, done ? "active" : "invited");
  }
  return result;
}

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
    const statuses = await storeDisplayStatuses(data ?? []);
    return (data ?? []).map((s) => ({
      ...s,
      display_status: statuses.get(s.id) ?? ("suspended" as StoreDisplayStatus),
    }));
  });

/** Métricas do dashboard Master. */
export const masterStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_platform_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const [stores, products, orders] = await Promise.all([
      context.supabase.from("stores").select("id, name, status", { count: "exact" }),
      context.supabase.from("products").select("id", { count: "exact", head: true }),
      context.supabase.from("orders").select("id", { count: "exact", head: true }),
    ]);
    const byStatus: Record<StoreDisplayStatus, number> = { invited: 0, active: 0, suspended: 0 };
    const statuses = await storeDisplayStatuses(stores.data ?? []);
    for (const status of statuses.values()) byStatus[status]++;
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

// Origem do app (ex. https://vynka.lovable.app) + página que o link abre: /boas-vindas (cadastro
// completo do dono) ou /reset-password (só a senha).
// O Supabase só aceita destinos presentes em Authentication > URL Configuration.
function inviteRedirect(origin?: string, path: "/boas-vindas" | "/reset-password" = "/boas-vindas") {
  return origin ? { redirectTo: `${new URL(origin).origin}${path}` } : {};
}

// Link enviado ao dono: aponta direto para a página com o token na URL. Abrir a página não gasta
// o token (a prévia do WhatsApp abre o link sozinha); ele só é usado no clique do botão da tela.
// Sem origem, cai no link padrão do Supabase (que gasta o token ao ser aberto).
function accessLink(
  properties:
    | { action_link?: string; hashed_token?: string; verification_type?: string }
    | undefined,
  origin?: string,
  path: "/boas-vindas" | "/reset-password" = "/boas-vindas",
) {
  if (!origin || !properties?.hashed_token || !properties.verification_type) {
    return properties?.action_link ?? null;
  }
  const url = new URL(path, new URL(origin).origin);
  url.searchParams.set("token_hash", properties.hashed_token);
  url.searchParams.set("type", properties.verification_type);
  return url.toString();
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
      inviteLink = accessLink(link.data.properties, data.redirect_origin);
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
      status: z.enum(["active", "suspended"]),
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

const STORE_BUCKETS = ["product-images", "store-branding"] as const;

/**
 * Exclui de vez uma loja suspensa. Somente Master; exige o link (slug) da loja como confirmação.
 * O banco apaga em cascata produtos, categorias, pedidos, clientes, banners e membros; os arquivos
 * da loja (pasta {store_id}/ nos buckets) saem antes. O login do dono também é excluído se ele
 * não for membro de outra loja nem usuário da plataforma, o que libera o e-mail para novo convite.
 */
export const deleteStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ store_id: z.string().uuid(), confirm_slug: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_platform_admin", {
      _user_id: context.userId,
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: store, error: storeErr } = await supabaseAdmin
      .from("stores")
      .select("id, name, slug, status")
      .eq("id", data.store_id)
      .maybeSingle();
    if (storeErr) throw storeErr;
    if (!store) throw new Error("Loja não encontrada.");
    // cancelled = antigo "Arquivada", que hoje aparece como suspensa.
    if (store.status !== "suspended" && store.status !== "cancelled")
      throw new Error("Só é possível excluir uma loja suspensa.");
    if (data.confirm_slug.trim().toLowerCase() !== store.slug.toLowerCase())
      throw new Error("O link digitado não confere com o da loja.");

    const { data: members, error: memErr } = await supabaseAdmin
      .from("store_members")
      .select("user_id")
      .eq("store_id", store.id);
    if (memErr) throw memErr;
    const memberIds = [...new Set((members ?? []).map((m) => m.user_id as string))];

    // Arquivos: falha aqui não impede a exclusão, só deixa arquivo órfão (registrado no log).
    let filesRemoved = 0;
    const fileErrors: string[] = [];
    for (const bucket of STORE_BUCKETS) {
      // Remove em lotes de 1000 e lista de novo até a pasta esvaziar.
      for (let round = 0; round < 20; round++) {
        const { data: files, error } = await supabaseAdmin.storage
          .from(bucket)
          .list(store.id, { limit: 1000 });
        if (error) {
          fileErrors.push(bucket);
          break;
        }
        const paths = (files ?? []).map((f) => `${store.id}/${f.name}`);
        if (paths.length === 0) break;
        const { error: rmErr } = await supabaseAdmin.storage.from(bucket).remove(paths);
        if (rmErr) {
          fileErrors.push(bucket);
          break;
        }
        filesRemoved += paths.length;
      }
    }

    // categories.parent_id é ON DELETE RESTRICT: solta a hierarquia antes da cascata.
    const { error: catErr } = await supabaseAdmin
      .from("categories")
      .update({ parent_id: null })
      .eq("store_id", store.id);
    if (catErr) throw catErr;

    const { error: delErr } = await supabaseAdmin.from("stores").delete().eq("id", store.id);
    if (delErr) throw delErr;

    // Dono sem outra loja e fora da plataforma: apaga o login (profile sai em cascata).
    const usersRemoved: string[] = [];
    const usersKept: string[] = [];
    for (const userId of memberIds) {
      if (userId === context.userId) {
        usersKept.push(userId);
        continue;
      }
      const [{ count: otherStores }, { count: platform }] = await Promise.all([
        supabaseAdmin
          .from("store_members")
          .select("user_id", { count: "exact", head: true })
          .eq("user_id", userId),
        supabaseAdmin
          .from("platform_users")
          .select("user_id", { count: "exact", head: true })
          .eq("user_id", userId),
      ]);
      if ((otherStores ?? 0) > 0 || (platform ?? 0) > 0) {
        usersKept.push(userId);
        continue;
      }
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) usersKept.push(userId);
      else usersRemoved.push(userId);
    }

    await supabaseAdmin.from("audit_logs").insert({
      actor_user_id: context.userId,
      actor_type: "master",
      store_id: null,
      action: "store.delete",
      entity_type: "store",
      entity_id: store.id,
      metadata: {
        name: store.name,
        slug: store.slug,
        files_removed: filesRemoved,
        file_errors: fileErrors,
        users_removed: usersRemoved,
        users_kept: usersKept,
      },
    });
    return { ok: true, users_removed: usersRemoved.length, file_errors: fileErrors };
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
 * quem já entrou recebe um link de redefinição de senha. Se o dono ainda não completou o
 * cadastro, o link abre /boas-vindas; senão, /reset-password. Somente Master.
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

    // Cadastro completo = marcado pela tela de boas-vindas, ou loja antiga que já tem nome definitivo.
    const { data: store } = await supabaseAdmin
      .from("stores").select("name").eq("id", data.store_id).maybeSingle();
    const signupDone =
      userRes.user.user_metadata?.signup_completed === true || !isProvisionalName(store?.name);

    const type = userRes.user.last_sign_in_at ? "recovery" : "invite";
    const path = signupDone ? "/reset-password" : "/boas-vindas";
    const link = await supabaseAdmin.auth.admin.generateLink({
      type,
      email,
      options: inviteRedirect(data.redirect_origin, path),
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
    return {
      ok: true,
      invite_link: accessLink(link.data.properties, data.redirect_origin, path),
      link_type: type,
    };
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

/** Logins de administração das lojas (dono/admin), para a tela Usuários do Master. */
export const listStoreUsersForMaster = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_platform_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: members, error } = await supabaseAdmin
      .from("store_members")
      .select("user_id, role, active, created_at, store:stores(id, name, slug, status)")
      .in("role", ["owner", "admin"])
      .order("created_at", { ascending: false });
    if (error) throw error;

    const userIds = [...new Set((members ?? []).map((m) => m.user_id as string))];
    const { data: profiles } = userIds.length
      ? await supabaseAdmin.from("profiles").select("user_id, full_name, phone").in("user_id", userIds)
      : { data: [] as { user_id: string; full_name: string | null; phone: string | null }[] };

    // Um listUsers paginado em vez de um getUserById por usuário.
    const authById = new Map<string, { email: string | null; last_sign_in_at: string | null; signup_completed: boolean }>();
    const perPage = 200;
    for (let page = 1; page <= 10; page++) {
      const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (listErr) throw listErr;
      for (const u of list.users) {
        authById.set(u.id, {
          email: u.email ?? null,
          last_sign_in_at: u.last_sign_in_at ?? null,
          signup_completed: u.user_metadata?.signup_completed === true,
        });
      }
      if (list.users.length < perPage) break;
    }

    return (members ?? []).map((m) => {
      const store = (Array.isArray(m.store) ? m.store[0] : m.store) as
        | { id: string; name: string; slug: string; status: string }
        | null;
      const auth = authById.get(m.user_id as string);
      const profile = (profiles ?? []).find((p) => p.user_id === m.user_id);
      const signupDone = !!auth?.signup_completed || (!!store && !isProvisionalName(store.name));
      return {
        user_id: m.user_id as string,
        role: m.role as string,
        member_active: m.active as boolean,
        name: profile?.full_name || null,
        phone: profile?.phone || null,
        email: auth?.email ?? null,
        last_sign_in_at: auth?.last_sign_in_at ?? null,
        signup_done: signupDone,
        store,
      };
    });
  });
