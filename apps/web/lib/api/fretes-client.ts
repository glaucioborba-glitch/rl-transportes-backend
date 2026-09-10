import { staffJson } from "@/lib/api/staff-client";
import type { StatusFrete, TipoFrete } from "@/lib/fretes/frete-status";

export type FreteRow = {
  id: string;
  dataRef: string;
  janela: string | null;
  turno: "MANHA" | "TARDE" | null;
  numeroIso: string;
  statusCarga: "CHEIO" | "VAZIO";
  tipo: TipoFrete;
  local: string | null;
  clienteId: string | null;
  clienteNome: string;
  motoristaNome: string | null;
  cpfMotorista: string | null;
  placaCavalo: string | null;
  placaCarreta: string | null;
  valor: number | null;
  booking: string | null;
  observacao: string | null;
  status: StatusFrete;
  solicitacaoId: string | null;
  agendamentoId: string | null;
  protocolo: string | null;
};

export type FreteWrite = {
  dataRef: string;
  janela?: string | null;
  turno?: "MANHA" | "TARDE" | null;
  numeroIso: string;
  statusCarga: "CHEIO" | "VAZIO";
  tipo: TipoFrete;
  local?: string | null;
  clienteNome: string;
  motoristaNome?: string | null;
  cpfMotorista?: string | null;
  placaCavalo?: string | null;
  placaCarreta?: string | null;
  valor?: number | null;
  booking?: string | null;
  observacao?: string | null;
  status?: StatusFrete;
};

export function listFretes(params: { from?: string; to?: string; status?: string; q?: string }) {
  const qs = new URLSearchParams();
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.status) qs.set("status", params.status);
  if (params.q?.trim()) qs.set("q", params.q.trim());
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return staffJson<{ items: FreteRow[]; total: number }>(`/v2/fretes${suffix}`);
}

export function createFrete(body: FreteWrite) {
  return staffJson<FreteRow>("/v2/fretes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function patchFrete(id: string, body: Partial<FreteWrite>) {
  return staffJson<FreteRow>(`/v2/fretes/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function sincronizarFretes() {
  return staffJson<{ criados: number; analisados: number }>("/v2/fretes/sincronizar", {
    method: "POST",
  });
}
