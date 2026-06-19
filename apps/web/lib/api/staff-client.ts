import type { ContainerRicPayload, ContainerTimelineResponse } from "@/lib/container-timeline";
import { stripContainerISO } from "@/utils/containerFormatter";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { ApiError, authRefresh, getApiBase } from "@/lib/api/corporate-auth-client";
import { applyCsrfHeaders } from "@/lib/csrf-client";
import { appendDeviceSecurityHeaders } from "@/lib/device-client-headers";
import { maybeUnwrapCircuitJson } from "@/lib/resilience/circuit-open";

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  try {
    const raw = JSON.parse(text) as Record<string, unknown>;
    return maybeUnwrapCircuitJson<T>(raw);
  } catch {
    throw new ApiError("Resposta inválida da API", res.status);
  }
}

export { ApiError } from "@/lib/api/corporate-auth-client";

const STAFF_EXT_HEADERS: Record<string, string> = { "X-RL-Auth-Cookie": "1" };

/** Requisição intranet/staff: cookies HttpOnly + header para o Nest emitir/ler `rl_at` / `rl_rt`. */
export async function staffRequest(path: string, init?: RequestInit): Promise<Response> {
  const base = getApiBase();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;

  const doFetch = async () => {
    const headers = new Headers(init?.headers);
    if (!headers.has("Accept")) headers.set("Accept", "application/json");
    for (const [k, v] of Object.entries(STAFF_EXT_HEADERS)) {
      if (!headers.has(k)) headers.set(k, v);
    }
    applyCsrfHeaders(headers, init?.method);
    await appendDeviceSecurityHeaders(headers);
    return fetch(url, { ...init, headers, credentials: "include" });
  };

  let res = await doFetch();

  if (res.status === 401) {
    try {
      await authRefresh(null, { cookieMode: true });
      res = await doFetch();
    } catch {
      useStaffAuthStore.getState().clear();
      if (typeof window !== "undefined") {
        const { clearStaffSessionCookie } = await import("@/lib/auth-staff-cookie");
        clearStaffSessionCookie();
      }
      throw new ApiError("Sessão expirada", 401);
    }
  }

  return res;
}

export async function staffDownloadSolicitacaoV2Pdf(id: string): Promise<Blob> {
  const res = await staffRequest(`/v2/solicitacoes/${encodeURIComponent(id)}/pdf`, {
    method: "GET",
    headers: { Accept: "application/pdf" },
  });
  if (res.status === 401) {
    useStaffAuthStore.getState().clear();
    if (typeof window !== "undefined") {
      const { clearStaffSessionCookie } = await import("@/lib/auth-staff-cookie");
      clearStaffSessionCookie();
    }
    throw new ApiError("Não autorizado", 401);
  }
  if (!res.ok) {
    const err = await res.text();
    throw new ApiError(err || `Erro HTTP ${res.status}`, res.status);
  }
  return res.blob();
}

export async function staffJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await staffRequest(path, init);
  if (res.status === 401) {
    useStaffAuthStore.getState().clear();
    if (typeof window !== "undefined") {
      const { clearStaffSessionCookie } = await import("@/lib/auth-staff-cookie");
      clearStaffSessionCookie();
    }
    throw new ApiError("Não autorizado", 401);
  }
  if (!res.ok) {
    const err = await res.text();
    throw new ApiError(err || `Erro HTTP ${res.status}`, res.status);
  }
  return parseJson<T>(res);
}

export async function staffTryJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  const res = await staffRequest(path, init);
  if (res.status === 401) {
    useStaffAuthStore.getState().clear();
    if (typeof window !== "undefined") {
      const { clearStaffSessionCookie } = await import("@/lib/auth-staff-cookie");
      clearStaffSessionCookie();
    }
    throw new ApiError("Não autorizado", 401);
  }
  if (res.status === 404 || res.status === 405) {
    return null;
  }
  if (!res.ok) {
    const err = await res.text();
    throw new ApiError(err || `Erro HTTP ${res.status}`, res.status);
  }
  return parseJson<T>(res);
}

export async function staffFormData(path: string, form: FormData): Promise<Response> {
  return staffRequest(path, { method: "POST", body: form });
}

export type StaffSolicitacaoV2List = {
  items: unknown[];
  total: number;
  page: number;
  limit: number;
};

export async function staffFetchSolicitacaoV2Detalhe(id: string) {
  return staffJson<{
    solicitacao: Record<string, unknown>;
    auditoria: unknown[];
    securityAlerts: unknown[];
    timeline: Array<{
      id: string;
      tipo: string;
      titulo: string;
      subtitulo?: string;
      createdAt: string;
      meta?: Record<string, unknown>;
    }>;
    statusV2Label: string;
    resumoRisco: { totalAlertas: number; riscoMax: number | null };
  }>(`/v2/solicitacoes/${encodeURIComponent(id)}`);
}

export function staffListarSolicitacoesV2(params: { page?: number; limit?: number; status?: string }) {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.status) sp.set("status", params.status);
  const q = sp.toString();
  return staffJson<StaffSolicitacaoV2List>(`/v2/solicitacoes${q ? `?${q}` : ""}`);
}

export function staffAprovarSolicitacaoV2(id: string) {
  return staffJson<unknown>(`/v2/solicitacoes/${encodeURIComponent(id)}/aprovar`, { method: "POST" });
}

export function staffRejeitarSolicitacaoV2(id: string, motivo?: string) {
  return staffJson<unknown>(`/v2/solicitacoes/${encodeURIComponent(id)}/rejeitar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ motivo: motivo ?? undefined }),
  });
}

export function staffRemoverAnexoV2(anexoId: string) {
  return staffJson<{ removed: boolean }>(
    `/v2/solicitacoes/anexos/${encodeURIComponent(anexoId)}`,
    { method: "DELETE" },
  );
}

export function staffUploadAnexoV2(solicitacaoId: string, file: File) {
  const fd = new FormData();
  fd.append("file", file);
  return staffFormData(`/v2/solicitacoes/${encodeURIComponent(solicitacaoId)}/anexos`, fd).then(async (res) => {
    if (!res.ok) {
      const err = await res.text();
      throw new ApiError(err || `Erro HTTP ${res.status}`, res.status);
    }
    return parseJson<Record<string, unknown>>(res);
  });
}

export function staffSolicitacoesV2Metricas() {
  return staffJson<{
    periodoDias: number;
    desde: string;
    totalSolicitacoesV2: number;
    porTipoCaminhao: { LS: number; RODOTREM: number };
    containers: { cheio: number; vazio: number; refrigerados: number };
    criacoesPorDia: Array<{ dataRef: string; quantidade: number }>;
  }>("/v2/solicitacoes/metricas/resumo");
}

export type StaffGateFilaItem = {
  id: string;
  protocolo: string;
  containersIso?: string[];
  cliente: { id: string; razaoSocial: string };
  tipoCaminhao: string;
  statusDb: string;
  gateLabel: string;
  gateInAbertoId: string | null;
};

export function staffGateFila() {
  return staffJson<StaffGateFilaItem[]>("/v2/gate/fila");
}

export function staffGatePreCheckIn(solicitacaoId: string, hash?: string) {
  const q = hash?.trim() ? `?hash=${encodeURIComponent(hash.trim())}` : "";
  return staffJson<Record<string, unknown>>(`/v2/gate/solicitacoes/${encodeURIComponent(solicitacaoId)}/pre-checkin${q}`);
}

export function staffGateMetricas() {
  return staffJson<Record<string, unknown>>("/v2/gate/metricas/resumo");
}

export function staffGatePreCheckOut(gateInId: string) {
  return staffJson<Record<string, unknown>>(`/v2/gate/check-ins/${encodeURIComponent(gateInId)}/pre-checkout`);
}

export async function staffGateCheckIn(solicitacaoId: string, payload: Record<string, unknown>, fotos: File[]) {
  const fd = new FormData();
  fd.append("data", JSON.stringify(payload));
  for (const f of fotos) fd.append("fotos", f);
  const res = await staffRequest(`/v2/gate/solicitacoes/${encodeURIComponent(solicitacaoId)}/check-in`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new ApiError(err || `Erro HTTP ${res.status}`, res.status);
  }
  return parseJson<Record<string, unknown>>(res);
}

export async function staffGateCheckOut(gateInId: string, payload: Record<string, unknown>, fotos: File[]) {
  const fd = new FormData();
  fd.append("data", JSON.stringify(payload));
  for (const f of fotos) fd.append("fotos", f);
  const res = await staffRequest(`/v2/gate/check-ins/${encodeURIComponent(gateInId)}/check-out`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new ApiError(err || `Erro HTTP ${res.status}`, res.status);
  }
  return parseJson<Record<string, unknown>>(res);
}

export async function staffGateOcrPlacaMock(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await staffRequest("/v2/gate/ocr/placa-mock", { method: "POST", body: fd });
  if (!res.ok) {
    const err = await res.text();
    throw new ApiError(err || `Erro HTTP ${res.status}`, res.status);
  }
  return parseJson<Record<string, unknown>>(res);
}

export type StaffPatioInventario = {
  geradoEm: string;
  lotacaoTotal: number;
  capacidadeTotal: number;
  reefersLigados: number;
  mediaHorasArmazenado: number | null;
  divergencias: { unidadeId: string; unidadeIso: string; status: string; motivo: string }[];
  baias: {
    id: string;
    codigoBaia: string;
    capacidade: number;
    ocupacao: number;
    ratio: number;
    cor: "verde" | "amarelo" | "vermelho";
    unidades: {
      id: string;
      unidadeIso: string;
      status: string;
      refrigerado: boolean;
      protocolo: string;
      cliente: string;
    }[];
  }[];
};

export function staffPatioInventario() {
  return staffJson<StaffPatioInventario>("/v2/patio/inventario");
}

export function staffPatioPosicionar(payload: { unidadeId: string; codigoBaia: string; tipo?: string }) {
  return staffJson<Record<string, unknown>>("/v2/patio/posicionar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function staffPatioMovimentar(payload: Record<string, unknown>) {
  return staffJson<Record<string, unknown>>("/v2/patio/movimentar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function staffPatioHistoricoIso(iso: string) {
  return staffJson<Record<string, unknown>>(`/v2/patio/unidade/${encodeURIComponent(iso)}`);
}

export function staffGatePatioUnidades(gateInId: string) {
  return staffJson<Record<string, unknown>[]>(
    `/v2/gate/check-ins/${encodeURIComponent(gateInId)}/patio-unidades`,
  );
}

export async function staffGateEnviarPatio(
  gateInId: string,
  posicoes: { unidadeId: string; codigoBaia: string }[],
) {
  return staffJson<{ ok: boolean; posicionadas: number }>(
    `/v2/gate/check-ins/${encodeURIComponent(gateInId)}/enviar-patio`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ posicoes }),
    },
  );
}

export type DispatchAgendamentoCard = {
  agendamentoId: string;
  numeroIso: string;
  dataRef: string;
  turno: string;
  tipoOperacao: string;
  statusCarga: string;
  origem: string | null;
  destino: string | null;
  clienteNome: string;
  protocolo: string | null;
  booking: string | null;
};

export type DispatchBoardResponse = {
  pendentes: DispatchAgendamentoCard[];
  motoristas: {
    id: string;
    nome: string;
    telefone: string;
    status: string;
    ordemAtiva: (DispatchAgendamentoCard & { id: string; status: string; veiculoPlaca: string }) | null;
  }[];
};

export type DispatchVeiculo = { id: string; placa: string; tipo: string };

export function staffDispatchBoard() {
  return staffJson<DispatchBoardResponse>("/dispatch/board");
}

export function staffDispatchVeiculos() {
  return staffJson<DispatchVeiculo[]>("/dispatch/veiculos");
}

export function staffDispatchAssign(body: {
  agendamentoId: string;
  motoristaId: string;
  veiculoId: string;
}) {
  return staffJson<unknown>("/dispatch/assign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function staffContainerTimeline(isoDisplay: string) {
  const iso = stripContainerISO(isoDisplay);
  return staffJson<ContainerTimelineResponse>(
    `/admin/container/${encodeURIComponent(iso)}/timeline`,
  );
}

export function staffContainerRic(isoDisplay: string, tipo: "ENTRADA" | "SAIDA") {
  const iso = stripContainerISO(isoDisplay);
  return staffJson<ContainerRicPayload>(
    `/admin/container/${encodeURIComponent(iso)}/ric/${tipo}`,
  );
}
