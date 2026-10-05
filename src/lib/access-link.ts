import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Link de convite/redefinição enviado pelo master: /boas-vindas ou /reset-password com
// ?token_hash=...&type=invite|recovery. Abrir a página não gasta o token (a prévia do WhatsApp
// e de e-mail abre o link sozinha); ele só é usado quando a pessoa clica no botão da tela.

export type AccessLinkToken = { token_hash: string; type: "invite" | "recovery" };

/** Lê o token do link na URL atual, se houver. */
export function readAccessLinkToken(): AccessLinkToken | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const token_hash = params.get("token_hash");
  const type = params.get("type");
  if (!token_hash || (type !== "invite" && type !== "recovery")) return null;
  return { token_hash, type };
}

/** Usa o token (uso único) e abre a sessão. Em caso de erro, devolve o motivo para a tela. */
export async function redeemAccessLinkToken(
  token: AccessLinkToken,
): Promise<{ session: Session; error: null } | { session: null; error: string }> {
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: token.token_hash,
    type: token.type,
  });
  if (error || !data.session) {
    // O Supabase não diferencia link vencido de link já usado: os dois voltam como otp_expired.
    const reason =
      error?.code === "otp_expired"
        ? "Este link já foi usado ou venceu."
        : `Não foi possível validar o link${error?.message ? ` (${error.message})` : ""}.`;
    return { session: null, error: `${reason} Peça um novo link à VYNKA.` };
  }
  // Tira o token da barra de endereço: já foi usado e não deve ser copiado adiante.
  window.history.replaceState(null, "", window.location.pathname);
  return { session: data.session, error: null };
}
