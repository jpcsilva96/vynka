// Validação e máscara de CPF e celular, usadas no navegador e no servidor.

export const onlyDigits = (v: string) => v.replace(/\D/g, "");

/** CPF com 11 dígitos e dígitos verificadores válidos. */
export function isValidCpf(value: string) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  for (const len of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const digit = ((sum * 10) % 11) % 10;
    if (digit !== Number(cpf[len])) return false;
  }
  return true;
}

/** Celular/telefone com DDD: 10 ou 11 dígitos. */
export const isValidPhone = (value: string) => [10, 11].includes(onlyDigits(value).length);

/** 000.000.000-00 */
export function maskCpf(value: string) {
  const d = onlyDigits(value).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

/** (00) 00000-0000 ou (00) 0000-0000 */
export function maskPhone(value: string) {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Telefone gravado (com ou sem o 55 do país) mostrado como (00) 00000-0000. */
export function formatPhone(value: string | null | undefined) {
  const d = onlyDigits(value ?? "");
  return maskPhone(d.length > 11 && d.startsWith("55") ? d.slice(2) : d);
}
