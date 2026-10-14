import { onlyDigits } from "../../shared/validators";

const maskCpf = (d: string) =>
  d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");

/** Máscara automática: até 11 dígitos formata como CPF; acima, como CNPJ. */
export const maskCpfCnpj = (v: string) => {
  const d = onlyDigits(v).slice(0, 14);
  if (d.length <= 11) return maskCpf(d);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

export const maskCep = (v: string) => onlyDigits(v).slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");

export const maskPhone = (v: string) => {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

export interface ViaCepResult {
  rua: string;
  bairro: string;
  cidade: string;
  estado: string;
}

export async function lookupCep(cep: string, signal?: AbortSignal): Promise<ViaCepResult | null> {
  const digits = onlyDigits(cep);
  if (digits.length !== 8) return null;
  const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal });
  if (!res.ok) return null;
  const data = (await res.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
  if (data.erro) return null;
  return { rua: data.logradouro ?? "", bairro: data.bairro ?? "", cidade: data.localidade ?? "", estado: data.uf ?? "" };
}
