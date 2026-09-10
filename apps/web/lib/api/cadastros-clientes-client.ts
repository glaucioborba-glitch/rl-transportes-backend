import { staffJson } from "@/lib/api/staff-client";
import { defaultClientePapeisSafe } from "@/lib/cadastros/cliente-papeis";

export type CadastrosClienteListItem = {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  ie: string | null;
  telefone: string;
  cidade: string;
  uf: string;
  papeis?: string[];
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
  tipoCliente: string;
  papeis: string[];
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
  const raw = await staffJson<unknown>(`/v2/cadastros/clientes/${encodeURIComponent(id)}`);
  return mapCadastrosClienteForm(raw);
}

function toClienteWriteBody(data: CadastrosClienteFormData): Omit<CadastrosClienteFormData, "id"> {
  const { id: _id, ...body } = data;
  return body;
}

export async function createCadastrosCliente(
  data: CadastrosClienteFormData,
): Promise<CadastrosClienteFormData> {
  return staffJson<CadastrosClienteFormData>("/v2/cadastros/clientes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toClienteWriteBody(data)),
  });
}

export async function updateCadastrosCliente(
  id: string,
  data: CadastrosClienteFormData,
): Promise<CadastrosClienteFormData> {
  return staffJson<CadastrosClienteFormData>(`/v2/cadastros/clientes/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toClienteWriteBody(data)),
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
  tipoCliente: "PJ",
  papeis: ["CLIENTE"],
  ativo: true,
};

function str(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

/** Aceita o shape da API de cadastros e o objeto bruto do Prisma (cpfCnpj, enderecoCep, …). */
export function mapCadastrosClienteForm(raw: unknown): CadastrosClienteFormData {
  const data = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    ...EMPTY_CLIENTE_FORM,
    id: str(data.id) || undefined,
    razaoSocial: str(data.razaoSocial ?? data.nome),
    nomeFantasia: str(data.nomeFantasia),
    cnpj: str(data.cnpj ?? data.cpfCnpj).replace(/\D/g, ""),
    ie: str(data.ie ?? data.inscricaoEstadual),
    im: str(data.im ?? data.inscricaoMunicipal),
    email: str(data.email),
    telefone: str(data.telefone).replace(/\D/g, ""),
    celular: str(data.celular ?? data.responsavelTelefone).replace(/\D/g, ""),
    cep: str(data.cep ?? data.enderecoCep).replace(/\D/g, ""),
    endereco: str(data.endereco ?? data.enderecoLogradouro),
    numero: str(data.numero ?? data.enderecoNumero),
    complemento: str(data.complemento ?? data.enderecoComplemento),
    bairro: str(data.bairro ?? data.enderecoBairro),
    cidade: str(data.cidade ?? data.enderecoCidade),
    uf: str(data.uf ?? data.enderecoUf).toUpperCase().slice(0, 2),
    observacoes: str(data.observacoes),
    condicaoPagamento: str(data.condicaoPagamento),
    limiteCredito: str(data.limiteCredito),
    tipoCliente: str(data.tipoCliente ?? data.tipo) || "PJ",
    papeis: defaultClientePapeisSafe(data.papeis),
    ativo: data.ativo == null ? data.deletedAt == null : Boolean(data.ativo),
  };
}
