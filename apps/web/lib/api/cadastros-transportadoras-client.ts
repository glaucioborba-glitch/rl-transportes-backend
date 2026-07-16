import type { Dispatch, SetStateAction } from "react";
import { staffJson } from "@/lib/api/staff-client";
import { buscarCadastrosCep } from "@/lib/api/cadastros-clientes-client";

export type CadastrosTransportadoraListItem = {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  rntrc: string | null;
  rntrcValidade: string | null;
  cidade: string | null;
  uf: string | null;
  telefone: string | null;
  ativo: boolean;
  motoristasAtivos: number;
  frotaTotal: number;
  solicitacoesMes: number;
};

export type CadastrosTransportadoraFormData = {
  id?: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  rntrc: string;
  rntrcValidade: string;
  ie: string;
  email: string;
  telefone: string;
  celular: string;
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  frotaTotal: number;
  tiposVeiculo: string[];
  rotasAutorizadas: string[];
  condicaoPagamento: string;
  observacoes: string;
  ativo: boolean;
};

export type CadastrosTransportadoraListResponse = {
  items: CadastrosTransportadoraListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type CadastrosTransportadoraAuditEntry = {
  id: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "READ";
  createdAt: string;
  userName: string;
  userEmail: string;
  changes: { field: string; before: string; after: string }[];
};

export type RntrcValidationResponse = {
  valido: boolean;
  razaoSocial?: string | null;
  validade?: string | null;
  message?: string;
  aviso?: string;
  fonte?: string;
};

function qs(params: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const EMPTY_TRANSPORTADORA_FORM: CadastrosTransportadoraFormData = {
  razaoSocial: "",
  nomeFantasia: "",
  cnpj: "",
  rntrc: "",
  rntrcValidade: "",
  ie: "",
  email: "",
  telefone: "",
  celular: "",
  cep: "",
  endereco: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  frotaTotal: 0,
  tiposVeiculo: [],
  rotasAutorizadas: [],
  condicaoPagamento: "",
  observacoes: "",
  ativo: true,
};

export async function listCadastrosTransportadoras(params: {
  search?: string;
  status?: "todos" | "ativas" | "inativas";
  page?: number;
  limit?: number;
}): Promise<CadastrosTransportadoraListResponse> {
  return staffJson<CadastrosTransportadoraListResponse>(
    `/v2/cadastros/transportadoras${qs({
      search: params.search,
      status: params.status ?? "ativas",
      page: params.page ?? 1,
      limit: params.limit,
    })}`,
  );
}

export async function getCadastrosTransportadora(
  id: string,
): Promise<CadastrosTransportadoraFormData> {
  return staffJson<CadastrosTransportadoraFormData>(
    `/v2/cadastros/transportadoras/${encodeURIComponent(id)}`,
  );
}

export async function createCadastrosTransportadora(
  data: CadastrosTransportadoraFormData,
): Promise<CadastrosTransportadoraFormData> {
  return staffJson<CadastrosTransportadoraFormData>("/v2/cadastros/transportadoras", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateCadastrosTransportadora(
  id: string,
  data: CadastrosTransportadoraFormData,
): Promise<CadastrosTransportadoraFormData> {
  return staffJson<CadastrosTransportadoraFormData>(
    `/v2/cadastros/transportadoras/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
}

export async function inativarCadastrosTransportadora(
  id: string,
): Promise<{ id: string; removed: boolean }> {
  return staffJson(`/v2/cadastros/transportadoras/${encodeURIComponent(id)}/inativar`, {
    method: "PATCH",
  });
}

export async function fetchCadastrosTransportadoraAuditoria(
  id: string,
): Promise<CadastrosTransportadoraAuditEntry[]> {
  return staffJson<CadastrosTransportadoraAuditEntry[]>(
    `/v2/cadastros/transportadoras/${encodeURIComponent(id)}/auditoria`,
  );
}

export async function validateCadastrosRntrc(rntrc: string): Promise<RntrcValidationResponse> {
  const clean = rntrc.replace(/\D/g, "");
  return staffJson<RntrcValidationResponse>(
    `/v2/cadastros/validate/rntrc/${clean}`,
  );
}

export async function buscaCepTransportadora<T extends Record<string, unknown>>(
  cep: string,
  setFormData: Dispatch<SetStateAction<T>>,
) {
  const clean = cep.replace(/\D/g, "");
  if (clean.length !== 8) return;
  try {
    const data = await buscarCadastrosCep(clean);
    if (data.logradouro) {
      setFormData((prev) => ({
        ...prev,
        endereco: data.logradouro,
        bairro: data.bairro,
        cidade: data.localidade,
        uf: data.uf,
        complemento: data.complemento || (prev.complemento as string) || "",
      }));
    }
  } catch {
    /* não bloqueia */
  }
}
