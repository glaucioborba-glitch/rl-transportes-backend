import { staffJson } from "@/lib/api/staff-client";

export type CadastrosClienteListItem = {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  ie: string | null;
  telefone: string;
  cidade: string;
  uf: string;
  ativo: boolean;
  contratosAtivos: number;
  solicitacoes: number;
};

export type CadastrosClienteFormData = {
  id?: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  ie: string;
  im: string;
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
  observacoes: string;
  condicaoPagamento: string;
  limiteCredito: string;
  segmento: string;
  tipoCliente: string;
  ativo: boolean;
};

export type CadastrosClienteListResponse = {
  items: CadastrosClienteListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type CadastrosClienteAuditEntry = {
  id: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "READ";
  createdAt: string;
  userName: string;
  userEmail: string;
  changes: { field: string; before: string; after: string }[];
};

export type CnpjValidationResponse = {
  valido?: boolean;
  razaoSocial?: string | null;
  nomeFantasia?: string | null;
  cep?: string | null;
  endereco?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  email?: string | null;
  telefone?: string | null;
};

export type CepLookupResponse = {
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  complemento?: string;
};

function qs(params: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export async function listCadastrosClientes(params: {
  search?: string;
  status?: "todos" | "ativos" | "inativos";
  page?: number;
}): Promise<CadastrosClienteListResponse> {
  return staffJson<CadastrosClienteListResponse>(
    `/v2/cadastros/clientes${qs({
      search: params.search,
      status: params.status ?? "ativos",
      page: params.page ?? 1,
    })}`,
  );
}

export async function getCadastrosCliente(id: string): Promise<CadastrosClienteFormData> {
  return staffJson<CadastrosClienteFormData>(`/v2/cadastros/clientes/${encodeURIComponent(id)}`);
}

export async function createCadastrosCliente(
  data: CadastrosClienteFormData,
): Promise<CadastrosClienteFormData> {
  return staffJson<CadastrosClienteFormData>("/v2/cadastros/clientes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateCadastrosCliente(
  id: string,
  data: CadastrosClienteFormData,
): Promise<CadastrosClienteFormData> {
  return staffJson<CadastrosClienteFormData>(`/v2/cadastros/clientes/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function inativarCadastrosCliente(id: string): Promise<{ id: string; removed: boolean }> {
  return staffJson(`/v2/cadastros/clientes/${encodeURIComponent(id)}/inativar`, {
    method: "PATCH",
  });
}

export async function fetchCadastrosClienteAuditoria(
  id: string,
): Promise<CadastrosClienteAuditEntry[]> {
  return staffJson<CadastrosClienteAuditEntry[]>(
    `/v2/cadastros/clientes/${encodeURIComponent(id)}/auditoria`,
  );
}

export async function validateCadastrosCnpj(cnpj: string): Promise<CnpjValidationResponse> {
  const clean = cnpj.replace(/\D/g, "");
  return staffJson<CnpjValidationResponse>(`/v2/cadastros/validate/cnpj/${clean}`);
}

export async function buscarCadastrosCep(cep: string): Promise<CepLookupResponse> {
  const clean = cep.replace(/\D/g, "");
  return staffJson<CepLookupResponse>(`/v2/cadastros/cep/${clean}`);
}

export const EMPTY_CLIENTE_FORM: CadastrosClienteFormData = {
  razaoSocial: "",
  nomeFantasia: "",
  cnpj: "",
  ie: "",
  im: "",
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
  observacoes: "",
  condicaoPagamento: "",
  limiteCredito: "",
  segmento: "",
  tipoCliente: "PJ",
  ativo: true,
};
