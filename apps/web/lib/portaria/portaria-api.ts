import { ApiError, staffFetchSolicitacaoV2Detalhe, staffJson } from "@/lib/api/staff-client";
import type { QrCredencialPayload } from "@/lib/credencial-motorista";
import { formatTipoTamanhoContainerLabel } from "@/lib/cadastros/tipo-container-tamanhos";
import { stripContainerISO } from "@/utils/containerFormatter";

export type PortariaPrevisaoItem = {
  id: string;
  protocolo: string;
  horarioLabel: string;
  placa: string;
  motorista: string;
  container: string;
};

export type PortariaCheckinResumo = {
  id: string;
  protocolo: string;
  placa: string;
  motorista: string;
  container: string;
  tipoTamanho: string;
};

type V2Row = {
  id: string;
  protocolo: string;
  status: string;
  portaria?: unknown;
  agendamentoSolicitacao?: { dataRef: string; turno: string } | null;
  transporteSolicitacao?: {
    placaCavalo?: string | null;
    nomeMotorista?: string | null;
    tipoCaminhao?: string | null;
  } | null;
  containersSolicitacao?: Array<{ unidade: string; tipo?: string | null; tamanho?: string | null }>;
};

const TURNO_LABEL: Record<string, string> = {
  MANHA: "Manhã",
  TARDE: "Tarde",
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function turnoSortKey(turno?: string): number {
  return turno === "TARDE" ? 2 : 1;
}

function containerLabel(row: V2Row): string {
  const c = row.containersSolicitacao?.[0];
  if (!c?.unidade) return "—";
  return stripContainerISO(c.unidade) || "—";
}

function tipoTamanhoLabel(row: V2Row): string {
  const c = row.containersSolicitacao?.[0];
  if (!c) return "—";
  return formatTipoTamanhoContainerLabel(c.tipo, c.tamanho) ?? "—";
}

function mapPrevisao(row: V2Row): PortariaPrevisaoItem {
  const ag = row.agendamentoSolicitacao;
  const turno = ag?.turno ? TURNO_LABEL[ag.turno] ?? ag.turno : "—";
  const t = row.transporteSolicitacao;
  return {
    id: row.id,
    protocolo: row.protocolo,
    horarioLabel: turno,
    placa: t?.placaCavalo?.trim() || "—",
    motorista: t?.nomeMotorista?.trim() || "—",
    container: containerLabel(row),
  };
}

/** Agendamentos do dia com status elegível e sem check-in na portaria. */
export async function fetchPortariaPrevisao(): Promise<PortariaPrevisaoItem[]> {
  const hoje = todayIso();
  const statuses = ["APROVADO", "AGUARDANDO_GATE_IN"] as const;
  const all: V2Row[] = [];

  for (const status of statuses) {
    const res = await staffJson<{ items: V2Row[] }>(
      `/v2/solicitacoes?status=${status}&limit=100&page=1`,
    );
    all.push(...(res.items ?? []));
  }

  return all
    .filter((row) => {
      if (row.portaria) return false;
      const dataRef = row.agendamentoSolicitacao?.dataRef;
      if (!dataRef) return false;
      return String(dataRef).slice(0, 10) === hoje;
    })
    .sort(
      (a, b) =>
        turnoSortKey(a.agendamentoSolicitacao?.turno) -
          turnoSortKey(b.agendamentoSolicitacao?.turno) ||
        a.protocolo.localeCompare(b.protocolo),
    )
    .map(mapPrevisao);
}

export function parseQrCredencialPayload(raw: string): QrCredencialPayload | null {
  try {
    const parsed = JSON.parse(raw) as QrCredencialPayload;
    if (!parsed?.protocolo) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function resolveSolicitacaoByProtocolo(protocolo: string): Promise<V2Row | null> {
  const needle = protocolo.trim();
  if (!needle) return null;

  const res = await staffJson<{ items: Array<{ id: string; protocolo: string }> }>(
    `/solicitacoes?protocolo=${encodeURIComponent(needle)}&limit=5&page=1`,
  );
  const stub = (res.items ?? []).find(
    (r) => r.protocolo?.toUpperCase() === needle.toUpperCase() || r.protocolo?.includes(needle),
  );
  if (!stub?.id) {
    const wide = await staffJson<{ items: V2Row[] }>(`/v2/solicitacoes?limit=100&page=1`);
    return (
      (wide.items ?? []).find(
        (r) => r.protocolo?.toUpperCase() === needle.toUpperCase() || r.protocolo?.includes(needle),
      ) ?? null
    );
  }

  const detail = await staffFetchSolicitacaoV2Detalhe(stub.id);
  return detail.solicitacao as V2Row;
}

export function mapCheckinResumo(row: V2Row): PortariaCheckinResumo {
  const t = row.transporteSolicitacao;
  return {
    id: row.id,
    protocolo: row.protocolo,
    placa: t?.placaCavalo?.trim() || "—",
    motorista: t?.nomeMotorista?.trim() || "—",
    container: containerLabel(row),
    tipoTamanho: tipoTamanhoLabel(row),
  };
}

export type PortariaCheckinBody = {
  status: "CHEGOU_PORTARIA";
  fotos: {
    caminhao?: string;
    container?: string;
    documento?: string;
  };
  timestamp: string;
  placa: string;
  motoristaNome?: string;
};

export async function portariaCheckin(solicitacaoId: string, body: PortariaCheckinBody) {
  const res = await fetch(`/api/portaria/checkin/${encodeURIComponent(solicitacaoId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-RL-Auth-Cookie": "1" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    let message = text || `Erro HTTP ${res.status}`;
    try {
      const j = JSON.parse(text) as { message?: string };
      if (j.message) message = j.message;
    } catch {
      /* noop */
    }
    throw new ApiError(message, res.status);
  }
  return text ? (JSON.parse(text) as unknown) : {};
}
