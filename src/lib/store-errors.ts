// Mensagem de erro para o cliente da loja (lote de tela): a sessão vencida chega do servidor como
// "Unauthorized: ..." (auth-middleware) ou do banco como "JWT expired"; o cliente vê uma frase clara.
// Os demais erros já vêm escritos para o cliente e passam como estão.
export const SESSION_EXPIRED_MESSAGE =
  "Sua sessão expirou. Entre na sua conta de novo para continuar.";

export function storeErrorMessage(err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message : "";
  if (!message) return fallback;
  if (/^Unauthorized\b/i.test(message) || /jwt (expired|malformed)|invalid jwt/i.test(message)) {
    return SESSION_EXPIRED_MESSAGE;
  }
  return message;
}
