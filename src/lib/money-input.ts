// Campo de dinheiro com máscara (estilo app de banco): a pessoa digita só
// números e os centavos se formam pela direita. 4990 -> "49,90";
// 129990 -> "1.299,90". O texto do campo sempre fica nesse formato.

const MAX_DIGITS = 10; // até 99.999.999,99

const groupThousands = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

function formatCents(cents: number): string {
  const reais = Math.floor(cents / 100);
  const centavos = String(cents % 100).padStart(2, "0");
  return `${groupThousands(String(reais))},${centavos}`;
}

/** Texto digitado/colado -> texto com máscara ("" quando não sobra número). */
export function maskMoneyInput(raw: string): string {
  // Só os números contam: apagar "49,90" vira "49,9" -> 4,99 (como app de banco).
  const digits = raw.replace(/\D/g, "").replace(/^0+/, "").slice(0, MAX_DIGITS);
  if (!digits) return "";
  return formatCents(Number(digits));
}

/** Número salvo no banco -> texto com máscara. */
export function moneyInputFromNumber(value: number | string | null | undefined): string {
  if (value == null || value === "") return "";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "";
  return formatCents(Math.round(Math.abs(parsed) * 100));
}

/** Texto do campo -> número em reais (null quando vazio). */
export function parseMoneyInput(text: string | null | undefined): number | null {
  const clean = (text ?? "").trim().replace(/[R$\s]/g, "");
  if (!clean) return null;
  // Com vírgula: formato brasileiro ("1.299,90"). Sem vírgula: "49.90" ou "49".
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}
