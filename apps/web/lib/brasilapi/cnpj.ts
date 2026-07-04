/** Rota BFF no Next.js — proxy server-side para BrasilAPI (evita 403/CORS no browser). */
const CNPJ_LOOKUP_URL = "/api/external/cnpj";
/** Primeira chamada em dev pode compilar a rota BFF — margem além do proxy (8s). */
export const CNPJ_LOOKUP_TIMEOUT_MS = 12_000;

export const CNPJ_LOOKUP_FAIL_TOAST =
  "Não foi possível buscar os dados automaticamente. Por favor, preencha os campos abaixo.";

/** Lançada quando o toggle de cadastro desliga o auto-preenchimento (sem HTTP). */
export class CnpjAutofillDisabledError extends Error {
  constructor() {
    super("Auto-preenchimento CNPJ desativado.");
    this.name = "CnpjAutofillDisabledError";
  }
}

export function isCnpjLookupBenignError(e: unknown): boolean {
  if (e instanceof CnpjAutofillDisabledError) return true;
  if (e instanceof DOMException && e.name === "AbortError") return true;
  if (e instanceof Error && e.name === "AbortError") return true;
  return false;
}

export type CnpjDadosEmpresa = {
  razaoSocial: string;
  nomeFantasia: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  codigoMunicipioIbge: string | null;
  /** E-mail oficial na Receita Federal (BrasilAPI), quando disponível. */
  emailReceita: string | null;
};

export type ValidacaoDominioUi = "APROVADO" | "DIVERGENTE" | "INDISPONIVEL";

type BrasilApiCnpjPayload = {
  razao_social?: unknown;
  nome_fantasia?: unknown;
  cep?: unknown;
  logradouro?: unknown;
  numero?: unknown;
  complemento?: unknown;
  bairro?: unknown;
  municipio?: unknown;
  uf?: unknown;
  codigo_municipio_ibge?: unknown;
  email?: unknown;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asDigits(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value)).replace(/\D/g, "");
  }
  return asString(value).replace(/\D/g, "");
}

/** Normaliza payload da BrasilAPI para o formulário de cadastro PJ. */
export function mapBrasilApiCnpjPayload(body: BrasilApiCnpjPayload): CnpjDadosEmpresa {
  const razaoSocial = asString(body.razao_social);
  const nomeFantasiaRaw = asString(body.nome_fantasia);
  return {
    razaoSocial,
    nomeFantasia: nomeFantasiaRaw || razaoSocial,
    cep: asString(body.cep).replace(/\D/g, ""),
    logradouro: asString(body.logradouro),
    numero: asString(body.numero),
    complemento: asString(body.complemento),
    bairro: asString(body.bairro),
    municipio: asString(body.municipio),
    uf: asString(body.uf).toUpperCase(),
    codigoMunicipioIbge: (() => {
      const ibge = asDigits(body.codigo_municipio_ibge);
      return ibge.length >= 6 ? ibge : null;
    })(),
    emailReceita: (() => {
      const mail = asString(body.email);
      return mail.includes("@") ? mail : null;
    })(),
  };
}

/**
 * Consulta dados empresariais na BrasilAPI (Receita Federal).
 * @throws quando CNPJ inválido, timeout (5s), HTTP 4xx/5xx ou resposta malformada.
 */
export async function buscarDadosCnpj(
  cnpj: string,
  signal?: AbortSignal,
  autoPreencherCnpj = true,
): Promise<CnpjDadosEmpresa> {
  if (!autoPreencherCnpj) {
    throw new CnpjAutofillDisabledError();
  }

  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) {
    throw new Error("CNPJ deve ter 14 dígitos.");
  }

  const timeoutController = new AbortController();
  const onExternalAbort = () => timeoutController.abort();
  signal?.addEventListener("abort", onExternalAbort, { once: true });

  const timeoutId = setTimeout(() => timeoutController.abort(), CNPJ_LOOKUP_TIMEOUT_MS);

  try {
    const res = await fetch(`${CNPJ_LOOKUP_URL}/${digits}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: timeoutController.signal,
    });

    if (!res.ok) {
      throw new Error(`BrasilAPI HTTP ${res.status}`);
    }

    const json = (await res.json()) as BrasilApiCnpjPayload;
    const mapped = mapBrasilApiCnpjPayload(json);
    if (!mapped.razaoSocial) {
      throw new Error("Resposta da BrasilAPI sem razão social.");
    }
    return mapped;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", onExternalAbort);
  }
}
