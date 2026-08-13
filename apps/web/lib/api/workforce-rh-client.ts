import { staffJson } from "./staff-client";

export type CargoFuncionario = "GATE_CHECKER" | "OPERADOR_EMPILHADEIRA" | "ADMINISTRATIVO";
export type StatusFuncionario = "ATIVO" | "INATIVO";
export type TurnoEscala = "MANHA" | "TARDE" | "NOITE";

export type FuncionarioRow = {
  id: string;
  nome: string;
  cpf: string;
  cargo: CargoFuncionario;
  status: StatusFuncionario;
  createdAt: string;
  updatedAt: string;
};

export type EscalaTurnoRow = {
  id: string;
  funcionarioId: string;
  data: string;
  turno: TurnoEscala;
  funcionario?: Pick<FuncionarioRow, "id" | "nome" | "cargo" | "status">;
};

export const CARGO_LABELS: Record<CargoFuncionario, string> = {
  GATE_CHECKER: "Gate Checker",
  OPERADOR_EMPILHADEIRA: "Operador Empilhadeira",
  ADMINISTRATIVO: "Administrativo",
};

export const TURNO_LABELS: Record<TurnoEscala, string> = {
  MANHA: "Manhã",
  TARDE: "Tarde",
  NOITE: "Noite",
};

export function fetchFuncionarios(params?: { status?: StatusFuncionario; cargo?: CargoFuncionario }) {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.cargo) q.set("cargo", params.cargo);
  const qs = q.toString();
  return staffJson<FuncionarioRow[]>(`/workforce-rh/funcionarios${qs ? `?${qs}` : ""}`);
}

export function createFuncionario(body: {
  nome: string;
  cpf: string;
  cargo: CargoFuncionario;
  status?: StatusFuncionario;
}) {
  return staffJson<FuncionarioRow>("/workforce-rh/funcionarios", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function updateFuncionario(id: string, body: Partial<Pick<FuncionarioRow, "nome" | "cargo" | "status">>) {
  return staffJson<FuncionarioRow>(`/workforce-rh/funcionarios/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function inativarFuncionario(id: string) {
  return staffJson<FuncionarioRow>(`/workforce-rh/funcionarios/${encodeURIComponent(id)}/inativar`, {
    method: "POST",
  });
}

export function fetchEscalas(dataInicio: string, dataFim: string) {
  const q = new URLSearchParams({ dataInicio, dataFim });
  return staffJson<EscalaTurnoRow[]>(`/workforce-rh/escalas?${q}`);
}

export function upsertEscalas(
  escalas: Array<{ funcionarioId: string; data: string; turno: TurnoEscala | null }>,
) {
  return staffJson<{ ok: boolean; processadas: number }>("/workforce-rh/escalas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ escalas }),
  });
}
