import type { SolicitacaoRow } from "@/lib/api/portal-client";
import { intentLabel } from "@/lib/solicitacao-intent";
import { stripContainerISO } from "@/utils/containerFormatter";
import { isSolicitacaoTerminal } from "@/utils/janelaExecucao";

export type CredencialMotoristaData = {
  protocolo: string;
  versao: number;
  cliente: string;
  motorista: string;
  placas: string[];
  containers: string[];
  data: string;
  turno: string;
  turnoLabel: string;
  tipoOperacaoLabel: string;
};

export type QrCredencialPayload = {
  protocolo: string;
  versao: number;
  cliente: string;
  motorista: string;
  placas: string[];
  containers: string[];
  data: string;
  turno: string;
};

const TURNOS: Record<string, string> = {
  MANHA: "Manhã",
  TARDE: "Tarde",
};

/** Baixa e Coleta — frota do cliente (credencial QR na portaria). */
export function exibeCredencialMotorista(row: SolicitacaoRow): boolean {
  if (isSolicitacaoTerminal(row.status)) return false;
  const intent = row.tipoOperacao;
  return intent === "SOLICITAR_BAIXA" || intent === "SOLICITAR_COLETA";
}

export function containersIsoFromRow(row: SolicitacaoRow): string[] {
  const fromCorp = (row.containersSolicitacao ?? [])
    .slice()
    .sort((a, b) => a.ordem - b.ordem)
    .map((c) => stripContainerISO(c.unidade))
    .filter(Boolean);
  if (fromCorp.length) return fromCorp;

  return (row.unidades ?? [])
    .map((u) => stripContainerISO(u.numeroIso))
    .filter(Boolean);
}

export function placasFromRow(row: SolicitacaoRow): string[] {
  const t = row.transporteSolicitacao;
  if (!t) return [];
  return [t.placaCavalo, t.placaCarreta01, t.placaCarreta02]
    .map((p) => p?.trim().toUpperCase())
    .filter((p): p is string => Boolean(p));
}

/** Tenant B2B — nunca o operador (solicitanteContato). */
function clienteLabel(row: SolicitacaoRow): string {
  return (
    row.cliente?.nomeFantasia?.trim() ||
    row.cliente?.razaoSocial?.trim() ||
    "—"
  );
}

export function buildCredencialMotoristaData(row: SolicitacaoRow): CredencialMotoristaData | null {
  if (!exibeCredencialMotorista(row)) return null;

  const containers = containersIsoFromRow(row);
  if (!containers.length) return null;

  const ag = row.agendamentoSolicitacao;
  const data = ag?.dataRef ? String(ag.dataRef).slice(0, 10) : row.createdAt.slice(0, 10);
  const turno = ag?.turno ?? "MANHA";

  return {
    protocolo: row.protocolo,
    versao: row.versaoCredencial ?? 1,
    cliente: clienteLabel(row),
    motorista: row.transporteSolicitacao?.nomeMotorista?.trim() || "—",
    placas: placasFromRow(row),
    containers,
    data,
    turno,
    turnoLabel: TURNOS[turno] ?? turno,
    tipoOperacaoLabel: intentLabel(row.tipoOperacao ?? null),
  };
}

export function buildQrCredencialPayload(data: CredencialMotoristaData): string {
  const payload: QrCredencialPayload = {
    protocolo: data.protocolo,
    versao: data.versao,
    cliente: data.cliente,
    motorista: data.motorista,
    placas: data.placas,
    containers: data.containers,
    data: data.data,
    turno: data.turno,
  };
  return JSON.stringify(payload);
}

export function credencialShareText(data: CredencialMotoristaData): string {
  const placas = data.placas.length ? data.placas.join(" · ") : "—";
  const containers = data.containers.join(" · ");
  return [
    "Credencial RL Transportes",
    `Protocolo: ${data.protocolo}`,
    `Cliente: ${data.cliente}`,
    `Motorista: ${data.motorista}`,
    `Placas: ${placas}`,
    `Contêineres: ${containers}`,
    `Agendamento: ${data.data} · Turno ${data.turnoLabel}`,
    `Operação: ${data.tipoOperacaoLabel}`,
  ].join("\n");
}
