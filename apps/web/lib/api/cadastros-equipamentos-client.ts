import { staffJson } from "@/lib/api/staff-client";

export type EquipamentoStatus = "DISPONIVEL" | "EM_USO" | "EM_MANUTENCAO" | "INATIVO";

export type OperadorRef = {
  id: string;
  nome: string;
};

export type CadastrosEquipamentoListItem = {
  id: string;
  codigo: string;
  tipo: string;
  marca: string | null;
  modelo: string | null;
  capacidade: string | null;
  alturaMaxima: string | null;
  status: EquipamentoStatus | string;
  horimetro: number;
  proximaManutencao: string | null;
  ultimaManutencao: string | null;
  ativo: boolean;
  operadorAtual: OperadorRef | null;
};

export type CadastrosEquipamentoFormData = {
  id?: string;
  codigo: string;
  tipo: string;
  marca: string;
  modelo: string;
  capacidade: string;
  alturaMaxima: string;
  status: string;
  horimetro: number;
  ultimaManutencao: string;
  proximaManutencao: string;
  centroCusto: string;
  observacoes: string;
  ativo: boolean;
};

export type CadastrosEquipamentoListResponse = {
  items: CadastrosEquipamentoListItem[];
  total: number;
};

export type CadastrosEquipamentoAuditEntry = {
  id: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "READ";
  createdAt: string;
  userName: string;
  userEmail: string;
  changes: { field: string; before: string; after: string }[];
};

function qs(params: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) p.set(k, v);
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const EMPTY_EQUIPAMENTO_FORM: CadastrosEquipamentoFormData = {
  codigo: "",
  tipo: "EMPILHADEIRA_FRONTAL",
  marca: "",
  modelo: "",
  capacidade: "",
  alturaMaxima: "",
  status: "DISPONIVEL",
  horimetro: 0,
  ultimaManutencao: "",
  proximaManutencao: "",
  centroCusto: "",
  observacoes: "",
  ativo: true,
};

export async function listCadastrosEquipamentos(params: {
  search?: string;
  status?: "todos" | "disponiveis" | "em_uso" | "manutencao" | "inativos";
}): Promise<CadastrosEquipamentoListResponse> {
  return staffJson(`/v2/cadastros/equipamentos${qs({
    search: params.search,
    status: params.status ?? "todos",
  })}`);
}

export async function getCadastrosEquipamento(id: string): Promise<CadastrosEquipamentoFormData> {
  return staffJson(`/v2/cadastros/equipamentos/${encodeURIComponent(id)}`);
}

export async function createCadastrosEquipamento(
  data: CadastrosEquipamentoFormData,
): Promise<CadastrosEquipamentoFormData> {
  return staffJson("/v2/cadastros/equipamentos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateCadastrosEquipamento(
  id: string,
  data: CadastrosEquipamentoFormData,
): Promise<CadastrosEquipamentoFormData> {
  return staffJson(`/v2/cadastros/equipamentos/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function fetchCadastrosEquipamentoAuditoria(
  id: string,
): Promise<CadastrosEquipamentoAuditEntry[]> {
  return staffJson(`/v2/cadastros/equipamentos/${encodeURIComponent(id)}/auditoria`);
}

export async function vincularEquipamentoOperador(
  equipamentoId: string,
): Promise<{ equipamentoId: string; vinculado: boolean }> {
  return staffJson("/v2/operacional/vincular-equipamento", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ equipamentoId }),
  });
}

export async function desvincularEquipamentoOperador(): Promise<{ desvinculado: boolean }> {
  return staffJson("/v2/operacional/desvincular-equipamento", { method: "POST" });
}

export async function fetchEquipamentoAtual(
  userId: string,
): Promise<{ vinculado: boolean; equipamento: CadastrosEquipamentoListItem | null }> {
  return staffJson(`/v2/operacional/equipamento-atual/${encodeURIComponent(userId)}`);
}
