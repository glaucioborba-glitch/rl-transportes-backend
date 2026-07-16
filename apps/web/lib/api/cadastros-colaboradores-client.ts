import type { Dispatch, SetStateAction } from "react";
import { staffJson } from "@/lib/api/staff-client";
import { buscarCadastrosCep } from "@/lib/api/cadastros-clientes-client";

export type ColaboradorStatus = "ATIVO" | "AFASTADO" | "FERIAS" | "INATIVO";
export type ColaboradorVinculo =
  | "CLT"
  | "TERCEIRIZADO"
  | "ESTAGIARIO"
  | "TEMPORARIO"
  | "PRESTADOR";

export type CentroCustoRef = {
  codigo: string;
  nome: string;
};

export type GestorRef = {
  id: string;
  nome: string;
};

export type CadastrosColaboradorListItem = {
  id: string;
  nome: string;
  cargo: string | null;
  matricula: string | null;
  cpf: string;
  departamento: string | null;
  vinculo: ColaboradorVinculo | string;
  status: ColaboradorStatus | string;
  dataAdmissao: string;
  centroCusto: CentroCustoRef | null;
  gestor: GestorRef | null;
};

export type CadastrosColaboradorFormData = {
  id?: string;
  nome: string;
  cpf: string;
  rg: string;
  pis: string;
  dataNascimento: string;
  sexo: string;
  estadoCivil: string;
  nacionalidade: string;
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  email: string;
  telefone: string;
  celular: string;
  matricula: string;
  dataAdmissao: string;
  cargo: string;
  departamento: string;
  gestorId: string;
  vinculo: string;
  regimeTrabalho: string;
  jornadaSemanal: number;
  turno: string;
  centroCustoId: string;
  salario: string;
  contaBancaria: string;
  cnhNumero: string;
  cnhCategoria: string;
  cnhValidade: string;
  status: string;
  dataDemissao: string;
  motivoDemissao: string;
  observacoes: string;
};

export type CadastrosColaboradorListResponse = {
  items: CadastrosColaboradorListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type CadastrosColaboradorAuditEntry = {
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
  matricula?: string | null;
};

function qs(params: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const EMPTY_COLABORADOR_FORM: CadastrosColaboradorFormData = {
  nome: "",
  cpf: "",
  rg: "",
  pis: "",
  dataNascimento: "",
  sexo: "",
  estadoCivil: "",
  nacionalidade: "Brasileira",
  cep: "",
  endereco: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  email: "",
  telefone: "",
  celular: "",
  matricula: "",
  dataAdmissao: "",
  cargo: "",
  departamento: "",
  gestorId: "",
  vinculo: "CLT",
  regimeTrabalho: "CLT_44",
  jornadaSemanal: 44,
  turno: "T1",
  centroCustoId: "",
  salario: "",
  contaBancaria: "",
  cnhNumero: "",
  cnhCategoria: "",
  cnhValidade: "",
  status: "ATIVO",
  dataDemissao: "",
  motivoDemissao: "",
  observacoes: "",
};

export async function listCadastrosColaboradores(params: {
  search?: string;
  status?: "todos" | "ativos" | "inativos" | "afastados";
  vinculo?: string;
  page?: number;
}): Promise<CadastrosColaboradorListResponse> {
  return staffJson<CadastrosColaboradorListResponse>(
    `/v2/cadastros/colaboradores${qs({
      search: params.search,
      status: params.status ?? "ativos",
      vinculo: params.vinculo ?? "todos",
      page: params.page ?? 1,
    })}`,
  );
}

export async function getCadastrosColaborador(id: string): Promise<CadastrosColaboradorFormData> {
  return staffJson<CadastrosColaboradorFormData>(
    `/v2/cadastros/colaboradores/${encodeURIComponent(id)}`,
  );
}

export async function createCadastrosColaborador(
  data: CadastrosColaboradorFormData,
): Promise<CadastrosColaboradorFormData> {
  return staffJson<CadastrosColaboradorFormData>("/v2/cadastros/colaboradores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateCadastrosColaborador(
  id: string,
  data: CadastrosColaboradorFormData,
): Promise<CadastrosColaboradorFormData> {
  return staffJson<CadastrosColaboradorFormData>(
    `/v2/cadastros/colaboradores/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
}

export async function inativarCadastrosColaborador(
  id: string,
): Promise<{ id: string; removed: boolean }> {
  return staffJson(`/v2/cadastros/colaboradores/${encodeURIComponent(id)}/inativar`, {
    method: "PATCH",
  });
}

export async function fetchCadastrosColaboradorAuditoria(
  id: string,
): Promise<CadastrosColaboradorAuditEntry[]> {
  return staffJson<CadastrosColaboradorAuditEntry[]>(
    `/v2/cadastros/colaboradores/${encodeURIComponent(id)}/auditoria`,
  );
}

export async function checkCadastrosColaboradorCpf(
  cpf: string,
  excludeId?: string,
): Promise<CpfCheckResponse> {
  const clean = cpf.replace(/\D/g, "");
  const extra = excludeId ? `?excludeId=${encodeURIComponent(excludeId)}` : "";
  return staffJson<CpfCheckResponse>(
    `/v2/cadastros/colaboradores/check-cpf/${clean}${extra}`,
  );
}

export async function fetchCadastrosGestores(): Promise<GestorRef[]> {
  return staffJson<GestorRef[]>("/v2/cadastros/colaboradores/aux/gestores");
}

export async function fetchCadastrosCentrosCusto(): Promise<CentroCustoRef[]> {
  return staffJson<CentroCustoRef[]>("/v2/cadastros/colaboradores/aux/centros-custo");
}

export async function buscaCepColaborador<T extends Record<string, unknown>>(
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
