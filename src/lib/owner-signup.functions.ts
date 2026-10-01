import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isProvisionalName, isProvisionalSlug } from "@/lib/provisional-store";
import { isValidCpf, isValidPhone, onlyDigits } from "@/lib/br-documents";

// Cadastro do dono da loja ao abrir o convite (/boas-vindas): dados pessoais + nome e link da loja.
// A senha é definida no navegador (supabase.auth.updateUser) depois que estes dados são gravados.

/** Primeira loja ativa em que o usuário logado é dono. */
async function findOwnedStore(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("store_members")
    .select("store:stores(id, name, slug, whatsapp, status)")
    .eq("user_id", userId)
    .eq("role", "owner")
    .eq("active", true)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const stores = (data ?? [])
    .map(
      (m) =>
        m.store as {
          id: string;
          name: string;
          slug: string;
          whatsapp: string | null;
          status: string;
        } | null,
    )
    .filter((s): s is NonNullable<typeof s> => !!s && ["trial", "active"].includes(s.status));
  return stores[0] ?? null;
}

/** Dados para preencher a tela de boas-vindas. Nome/link provisórios voltam vazios. */
export const getOwnerSignup = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const store = await findOwnedStore(context.userId);
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, phone")
      .eq("user_id", context.userId)
      .maybeSingle();
    return {
      store: store
        ? {
            id: store.id,
            name: isProvisionalName(store.name) ? "" : store.name,
            slug: isProvisionalSlug(store.slug) ? "" : store.slug,
          }
        : null,
      profile: { full_name: profile?.full_name ?? "", phone: profile?.phone ?? "" },
    };
  });

const signupSchema = z.object({
  full_name: z.string().trim().min(3, "Informe o nome completo.").max(120),
  // Opcional (decisão de João); se vier, precisa ser um CPF válido.
  cpf: z
    .string()
    .optional()
    .transform((v) => (v ? onlyDigits(v) : ""))
    .refine((v) => v === "" || isValidCpf(v), "CPF inválido."),
  phone: z.string().transform(onlyDigits).refine(isValidPhone, "Informe o celular com DDD."),
  store_name: z.string().trim().min(2, "Informe o nome da loja.").max(120),
  slug: z
    .string()
    .min(2, "Informe o link da loja.")
    .max(60)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use apenas letras minúsculas, números e hífen.")
    .refine((v) => !isProvisionalSlug(v), "Escolha um link para a sua loja."),
});

/** Grava o cadastro do dono e o nome/link definitivos da loja. */
export const completeOwnerSignup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => signupSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const store = await findOwnedStore(context.userId);
    if (!store)
      throw new Error("Não encontramos uma loja vinculada ao seu acesso. Fale com a VYNKA.");

    const { data: taken, error: slugErr } = await supabaseAdmin
      .from("stores")
      .select("id")
      .eq("slug", data.slug)
      .neq("id", store.id)
      .maybeSingle();
    if (slugErr) throw slugErr;
    if (taken) throw new Error(`O link "${data.slug}" já está em uso. Escolha outro.`);

    const { error: storeErr } = await supabaseAdmin
      .from("stores")
      .update({
        name: data.store_name,
        slug: data.slug,
        responsible_name: data.full_name,
        // O celular do dono vira o WhatsApp da loja só se ainda não houver um.
        ...(store.whatsapp ? {} : { whatsapp: data.phone }),
      })
      .eq("id", store.id);
    if (storeErr) throw storeErr;

    const { error: profileErr } = await supabaseAdmin.from("profiles").upsert(
      {
        user_id: context.userId,
        full_name: data.full_name,
        phone: data.phone,
        cpf: data.cpf || null,
      },
      { onConflict: "user_id" },
    );
    if (profileErr) throw profileErr;

    await supabaseAdmin.from("audit_logs").insert({
      actor_user_id: context.userId,
      actor_type: "store_owner",
      store_id: store.id,
      action: "store.owner_signup",
      entity_type: "store",
      entity_id: store.id,
      // CPF e celular não entram no log (LGPD).
      metadata: { slug: data.slug },
    });

    return { ok: true, store_id: store.id };
  });
