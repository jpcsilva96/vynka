/* eslint-disable @typescript-eslint/no-explicit-any -- coluna store_login ainda fora do types.ts gerado (regenerar é pendência) */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Login do cliente separado por loja (escopo login-por-loja, L3). A conta de login do cliente usa um
// e-mail técnico interno (o Supabase só aceita cada e-mail uma vez na plataforma); o e-mail real e o
// telefone ficam na ficha da loja (customers, store_login = true). A marca "cliente desta loja" vai
// em app_metadata, que só o servidor grava.

const TECH_DOMAIN = "clientes.vynka.invalid";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

const digits = (value: string) => value.replace(/\D/g, "");

async function assertStoreOpen(db: any, storeId: string) {
  const { data: store } = await db
    .from("stores")
    .select("id")
    .eq("id", storeId)
    .eq("status", "active")
    .eq("publication_status", "published")
    .maybeSingle();
  if (!store) throw new Error("Loja indisponível.");
}

// Ficha com login nesta loja pelo e-mail ou pelo telefone (com DDD).
async function findStoreLogin(db: any, storeId: string, login: string) {
  const value = login.trim().toLowerCase();
  const query = db
    .from("customers")
    .select("id, user_id, email, phone")
    .eq("store_id", storeId)
    .eq("store_login", true)
    .not("user_id", "is", null);
  if (value.includes("@")) {
    const { data } = await query.ilike("email", value.replace(/[%_\\]/g, "\\$&"));
    return (data ?? [])[0] ?? null;
  }
  const phone = digits(value);
  if (phone.length < 10) return null;
  const { data } = await query.not("phone", "is", null);
  return (
    (data ?? []).find((row: { phone: string | null }) => digits(row.phone ?? "") === phone) ?? null
  );
}

// Entrar: devolve o e-mail técnico da conta para o navegador entrar com a senha. Sem conta, devolve
// um e-mail técnico que não existe (a resposta é sempre "E-mail ou senha incorretos", sem revelar
// quem tem conta). As tentativas de senha seguem limitadas pelo Supabase, por aparelho.
export const resolveCustomerLogin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ store_id: z.string().uuid(), login: z.string().trim().min(3).max(200) }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const row = await findStoreLogin(db, data.store_id, data.login);
    if (row?.user_id) {
      const { data: user } = await db.auth.admin.getUserById(row.user_id);
      const meta = user?.user?.app_metadata;
      if (user?.user?.email && meta?.role === "customer" && meta?.store_id === data.store_id) {
        return { email: user.user.email as string };
      }
    }
    return { email: `c-${crypto.randomUUID()}@${TECH_DOMAIN}` };
  });

// Criar conta nesta loja: conta técnica + ficha juntas. Sem confirmação de e-mail no MVP (João,
// 20/10). E-mail e telefone únicos entre as contas da loja (índices do L2 garantem no banco).
export const signUpStoreCustomer = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        store_id: z.string().uuid(),
        name: z.string().trim().min(2, "Informe seu nome.").max(120),
        phone: z
          .string()
          .transform(digits)
          .refine(
            (value) => value.length >= 10 && value.length <= 11,
            "Informe seu telefone com DDD.",
          ),
        email: z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(200),
        password: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres.").max(72),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    await assertStoreOpen(db, data.store_id);
    if (await findStoreLogin(db, data.store_id, data.email)) {
      throw new Error("Este e-mail já tem conta nesta loja. Entre com sua senha.");
    }
    if (await findStoreLogin(db, data.store_id, data.phone)) {
      throw new Error("Este telefone já tem conta nesta loja. Entre com sua senha.");
    }

    const techEmail = `c-${crypto.randomUUID()}@${TECH_DOMAIN}`;
    const { data: created, error } = await db.auth.admin.createUser({
      email: techEmail,
      password: data.password,
      email_confirm: true,
      app_metadata: { role: "customer", store_id: data.store_id },
      user_metadata: { full_name: data.name, phone: data.phone },
    });
    if (error || !created?.user)
      throw new Error("Não foi possível criar sua conta. Tente novamente.");

    const { error: fichaError } = await db.from("customers").insert({
      store_id: data.store_id,
      user_id: created.user.id,
      name: data.name,
      phone: data.phone,
      email: data.email,
      store_login: true,
    });
    if (fichaError) {
      await db.auth.admin.deleteUser(created.user.id);
      throw new Error(
        fichaError.code === "23505"
          ? "Este e-mail ou telefone já tem conta nesta loja. Entre com sua senha."
          : "Não foi possível criar sua conta. Tente novamente.",
      );
    }
    return { email: techEmail };
  });
