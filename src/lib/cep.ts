// Busca de endereço por CEP no ViaCEP (serviço público, sem chave). Só o CEP sai do navegador.
export interface CepAddress {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

export function cepDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 8);
}

export function formatCep(value: string) {
  const digits = cepDigits(value);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

// null = CEP não encontrado. Erro de rede vira exceção (o cliente segue preenchendo à mão).
export async function lookupCep(value: string): Promise<CepAddress | null> {
  const digits = cepDigits(value);
  if (digits.length !== 8) return null;
  const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
  if (!response.ok) throw new Error("cep_lookup_failed");
  const data = (await response.json()) as {
    erro?: boolean | string;
    logradouro?: string;
    bairro?: string;
    localidade?: string;
    uf?: string;
  };
  if (data.erro) return null;
  return {
    street: data.logradouro ?? "",
    neighborhood: data.bairro ?? "",
    city: data.localidade ?? "",
    state: data.uf ?? "",
  };
}
