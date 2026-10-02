import type { CxPortalRequestUser } from '../cx-portais/types/cx-portal.types';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { isTransportadoraTerceiraRole } from '../common/constants/portal-tenant-roles.util';

export const AUDIT_ENTIDADE_SOLICITACAO = 'SOLICITACAO';
export const AUDIT_ACAO_UPDATE = 'UPDATE';
export const AUDIT_ACAO_UNIDADE_ALTERADA = 'UNIDADE_ALTERADA';

export type AuditFieldDelta = {
  campo: string;
  label: string;
  antes: unknown;
  depois: unknown;
};

export type SolicitacaoAuditSnapshot = {
  transporte?: {
    nomeMotorista: string;
    cpfMotorista: string;
    placaCavalo: string;
    placaCarreta01: string;
    placaCarreta02: string | null;
  };
  agendamento?: {
    dataRef: string;
    turno: string;
  };
};

export const CRITICAL_FIELD_LABELS: Record<string, string> = {
  placaCavalo: 'Placa Cavalo',
  placaCarreta01: 'Placa Carreta 01',
  placaCarreta02: 'Placa Carreta 02',
  nomeMotorista: 'Motorista',
  cpfMotorista: 'CPF do motorista',
  dataRef: 'Data do agendamento',
  turno: 'Turno',
};

export function snapshotFromPersisted(sol: {
  transporteSolicitacao?: {
    nomeMotorista: string;
    cpfMotorista: string;
    placaCavalo: string;
    placaCarreta01: string;
    placaCarreta02: string | null;
  } | null;
  agendamentoSolicitacao?: {
    dataRef: Date;
    turno: string;
  } | null;
}): SolicitacaoAuditSnapshot {
  const snap: SolicitacaoAuditSnapshot = {};
  if (sol.transporteSolicitacao) {
    snap.transporte = {
      nomeMotorista: sol.transporteSolicitacao.nomeMotorista,
      cpfMotorista: sol.transporteSolicitacao.cpfMotorista,
      placaCavalo: sol.transporteSolicitacao.placaCavalo,
      placaCarreta01: sol.transporteSolicitacao.placaCarreta01,
      placaCarreta02: sol.transporteSolicitacao.placaCarreta02,
    };
  }
  if (sol.agendamentoSolicitacao) {
    snap.agendamento = {
      dataRef: sol.agendamentoSolicitacao.dataRef.toISOString().slice(0, 10),
      turno: sol.agendamentoSolicitacao.turno,
    };
  }
  return snap;
}

export function snapshotFromUpdateDto(dto: {
  transporte?: {
    nomeMotorista: string;
    cpfMotorista: string;
    placaCavalo: string;
    placaCarreta01: string;
    placaCarreta02?: string | null;
  };
  agendamento: { dataRef: string; turno: string };
}): SolicitacaoAuditSnapshot {
  const snap: SolicitacaoAuditSnapshot = {
    agendamento: {
      dataRef: dto.agendamento.dataRef,
      turno: dto.agendamento.turno,
    },
  };
  if (dto.transporte) {
    snap.transporte = {
      nomeMotorista: dto.transporte.nomeMotorista.trim(),
      cpfMotorista: dto.transporte.cpfMotorista.replace(/\D/g, ''),
      placaCavalo: dto.transporte.placaCavalo.trim().toUpperCase(),
      placaCarreta01: dto.transporte.placaCarreta01.trim().toUpperCase(),
      placaCarreta02: dto.transporte.placaCarreta02?.trim().toUpperCase() || null,
    };
  }
  return snap;
}

function pushDelta(
  deltas: AuditFieldDelta[],
  campo: string,
  antes: unknown,
  depois: unknown,
): void {
  const a = antes ?? '';
  const d = depois ?? '';
  if (String(a) === String(d)) return;
  deltas.push({
    campo,
    label: CRITICAL_FIELD_LABELS[campo] ?? campo,
    antes: a,
    depois: d,
  });
}

/** Compara snapshots e retorna apenas campos críticos alterados. */
export function diffSolicitacaoAuditSnapshots(
  before: SolicitacaoAuditSnapshot,
  after: SolicitacaoAuditSnapshot,
): AuditFieldDelta[] {
  const deltas: AuditFieldDelta[] = [];
  if (before.transporte || after.transporte) {
    pushDelta(deltas, 'nomeMotorista', before.transporte?.nomeMotorista, after.transporte?.nomeMotorista);
    pushDelta(deltas, 'cpfMotorista', before.transporte?.cpfMotorista, after.transporte?.cpfMotorista);
    pushDelta(deltas, 'placaCavalo', before.transporte?.placaCavalo, after.transporte?.placaCavalo);
    pushDelta(
      deltas,
      'placaCarreta01',
      before.transporte?.placaCarreta01,
      after.transporte?.placaCarreta01,
    );
    pushDelta(
      deltas,
      'placaCarreta02',
      before.transporte?.placaCarreta02,
      after.transporte?.placaCarreta02,
    );
  }
  if (before.agendamento || after.agendamento) {
    pushDelta(deltas, 'dataRef', before.agendamento?.dataRef, after.agendamento?.dataRef);
    pushDelta(deltas, 'turno', before.agendamento?.turno, after.agendamento?.turno);
  }
  return deltas;
}

export function resolveAuditActor(
  cx: CxPortalRequestUser,
  empresaNome?: string | null,
): {
  usuarioId: string;
  usuarioNome: string;
  usuarioRole: string;
  empresaNome: string | null;
  operadorNome: string;
} {
  const operadorNome =
    cx.pessoaAutorizada?.nome?.trim() ||
    cx.email?.trim() ||
    'Usuário portal';
  const empresa = empresaNome?.trim() || null;
  const role = cx.portalTenantRole ?? cx.portalPapel;
  return {
    usuarioId: cx.sub,
    usuarioNome: empresa ? `${empresa} · ${operadorNome}` : operadorNome,
    usuarioRole: String(role),
    empresaNome: empresa,
    operadorNome,
  };
}

export function formatAuditActorLabel(
  usuarioRole: string,
  usuarioNome: string,
  empresaNome?: string | null,
): string {
  if (isTransportadoraTerceiraRole(usuarioRole as Role)) {
    return empresaNome
      ? `A transportadora ${usuarioNome} (${empresaNome})`
      : `A transportadora ${usuarioNome}`;
  }
  if (
    usuarioRole === Role.ADMIN_CLIENTE ||
    usuarioRole === Role.CLIENTE ||
    usuarioRole === Role.OPERADOR_INTERNO ||
    usuarioRole === 'CLIENTE'
  ) {
    return empresaNome
      ? `O operador ${usuarioNome} da empresa ${empresaNome}`
      : `O operador ${usuarioNome}`;
  }
  if (usuarioRole === Role.ADMIN || usuarioRole === Role.GERENTE) {
    return `RL Transportes (${usuarioNome})`;
  }
  return usuarioNome;
}

export function isStaffGlobalReader(user: AuthUser): boolean {
  return user.role === Role.ADMIN || user.role === Role.GERENTE;
}
