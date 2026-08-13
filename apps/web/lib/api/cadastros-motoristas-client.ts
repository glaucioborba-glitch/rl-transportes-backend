import type { Dispatch, SetStateAction } from "react";
import { staffJson } from "@/lib/api/staff-client";
import { buscarCadastrosCep } from "@/lib/api/cadastros-clientes-client";

export type TransportadoraRef = {
  id: string;
  razaoSocial: string;
  cnpj: string;
};

export type CadastrosMotoristaListItem = {
  id: string;
  nome: string;
  cpf: string;
  celular: string | null;
  cnhCategoria: string | null;
  cnhValidade: string | null;
  ativo: boolean;
  transportadora: TransportadoraRef | null;
  viagensMes: number;
  ultimaViagem: string | null;
};

export type CadastrosMotoristaFormData = {
  id?: string;
  nome: string;
  cpf: string;
  rg: string;
  dataNascimento: string;
  celular: string;
  telefone: string;
  email: string;
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  transportadoraId: string;
  cnhNumero: string;
  cnhCategoria: string;
  cnhValidade: string;
  cnhUfEmissao: string;
  observacoes: string;
  ativo: boolean;
};

export type CadastrosMotoristaListResponse = {
  items: CadastrosMotoristaListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type CadastrosMotoristaAuditEntry = {
  id: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "READ";
  createdAt: string;
  userName: string;
  userEmail: string;
  changes: { field: string; before: string; after: string }[];
};

export type CpfCheckResponse = {
  exists: boolean;
  id?: string;
  nome?: string;
};

function qs(params: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const EMPTY_MOTORISTA_FORM: CadastrosMotoristaFormData = {
  nome: "",
  cpf: "",
  rg: "",
  dataNascimento: "",
  celular: "",
  telefone: "",
  email: "",
  cep: "",
  endereco: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  transportadoraId: "",
  cnhNumero: "",
  cnhCategoria: "",
  cnhValidade: "",
  cnhUfEmissao: "",
  observacoes: "",
  ativo: true,
};

export async function listCadastrosMotoristas(params: {
  search?: string;
  status?: "todos" | "ativos" | "inativos";
  transportadoraId?: string;
  page?: number;
  limit?: number;
}): Promise<CadastrosMotoristaListResponse> {
  return staffJson<CadastrosMotoristaListResponse>(
    `/v2/cadastros/motoristas${qs({
      search: params.search,
      status: params.status ?? "ativos",
      transportadoraId: params.transportadoraId,
      page: params.page ?? 1,
      limit: params.limit,
    })}`,
  );
}

export async function getCadastrosMotorista(id: string): Promise<CadastrosMotoristaFormData> {
  return staffJson<CadastrosMotoristaFormData>(
    `/v2/cadastros/motoristas/${encodeURIComponent(id)}`,
  );
}

export async function createCadastrosMotorista(
  data: CadastrosMotoristaFormData,
): Promise<CadastrosMotoristaFormData> {
  return staffJson<CadastrosMotoristaFormData>("/v2/cadastros/motoristas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateCadastrosMotorista(
  id: string,
  data: CadastrosMotoristaFormData,
): Promise<CadastrosMotoristaFormData> {
  return staffJson<CadastrosMotoristaFormData>(
    `/v2/cadastros/motoristas/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
}

export async function inativarCadastrosMotorista(
  id: string,
): Promise<{ id: string; removed: boolean }> {
  return staffJson(`/v2/cadastros/motoristas/${encodeURIComponent(id)}/inativar`, {
    method: "PATCH",
  });
}

export async function fetchCadastrosMotoristaAuditoria(
  id: string,
): Promise<CadastrosMotoristaAuditEntry[]> {
  return staffJson<CadastrosMotoristaAuditEntry[]>(
    `/v2/cadastros/motoristas/${encodeURIComponent(id)}/auditoria`,
  );
}

export async function checkCadastrosMotoristaCpf(
  cpf: string,
  excludeId?: string,
): Promise<CpfCheckResponse> {
  const clean = cpf.replace(/\D/g, "");
  const extra = excludeId ? `?excludeId=${encodeURIComponent(excludeId)}` : "";
  return staffJson<CpfCheckResponse>(
    `/v2/cadastros/motoristas/check-cpf/${clean}${extra}`,
  );
}

export async function buscaCepMotorista<T extends Record<string, unknown>>(
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
