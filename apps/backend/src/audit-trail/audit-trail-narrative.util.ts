import { CategoriaAuditLog, StatusBloqueioContainer, StatusPagamentoFatura, StatusSolicitacao, TipoBloqueioContainer } from '@prisma/client';
import type { AuditedPrismaModel } from './audit-trail.models';

export type AuditCaptureInput = {
  entidadeTipo: string;
  entidadeId: string;
  acao: string;
  categoria: CategoriaAuditLog;
  containerIso?: string | null;
  dadosAnteriores?: unknown;
  dadosNovos?: unknown;
  usuarioId: string;
  usuarioNome: string;
  usuarioRole: string;
  tenantId: string;
  ipAddress?: string;
};

function formatBrl(value: unknown): string {
  const n = typeof value === 'number' ? value : Number(String(value ?? 0).replace(',', '.'));
  if (!Number.isFinite(n)) return String(value ?? '—');
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function actorLabel(role: string, nome: string): string {
  if (role === 'SISTEMA') return 'O Sistema (CRON)';
  if (role === 'ADMIN' || role === 'GERENTE') return `O usuário ${nome}`;
  return `A usuária ${nome}`;
}

function containerSuffix(iso?: string | null): string {
  return iso ? ` no contêiner ${iso}` : '';
}

export function buildAuditNarrative(input: AuditCaptureInput): string {
  const actor = actorLabel(input.usuarioRole, input.usuarioNome);
  const iso = input.containerIso;
  const before = (input.dadosAnteriores ?? {}) as Record<string, unknown>;
  const after = (input.dadosNovos ?? {}) as Record<string, unknown>;

  switch (input.acao) {
    case 'FATURA_ALTERADA': {
      if (before.statusPagamento !== after.statusPagamento && after.statusPagamento === StatusPagamentoFatura.PAGO) {
        return `${actor} alterou o status da fatura ${after.numeroRps ?? input.entidadeId.slice(0, 8)} para Pago${after.origem ? ` via ${after.origem}` : ''}${containerSuffix(iso)}.`;
      }
      if (before.valorTotal !== after.valorTotal || before.valorAtualizado !== after.valorAtualizado) {
        const de = formatBrl(before.valorAtualizado ?? before.valorTotal);
        const para = formatBrl(after.valorAtualizado ?? after.valorTotal);
        return `${actor} alterou o valor da fatura${containerSuffix(iso)} de ${de} para ${para}.`;
      }
      return `${actor} alterou a fatura${containerSuffix(iso)}.`;
    }
    case 'FATURA_EXCLUIDA':
      return `${actor} removeu registro de fatura${containerSuffix(iso)}.`;
    case 'BLOQUEIO_APLICADO':
      return `${actor} aplicou um Bloqueio ${String(after.tipo ?? before.tipo ?? 'FINANCEIRO')}${containerSuffix(iso)}. Motivo: ${String(after.motivo ?? before.motivo ?? '—')}.`;
    case 'BLOQUEIO_LIBERADO':
      return `${actor} liberou bloqueio ${String(before.tipo ?? 'FINANCEIRO')}${containerSuffix(iso)}.`;
    case 'BLOQUEIO_EXCLUIDO':
      return `${actor} removeu bloqueio${containerSuffix(iso)}.`;
    case 'GATE_IN_REALIZADO':
      return `${actor} registrou o Gate-In do contêiner ${iso ?? '—'}.`;
    case 'GATE_OUT_REALIZADO':
      return `${actor} registrou o Gate-Out do contêiner ${iso ?? '—'}.`;
    case 'SOLICITACAO_ALTERADA': {
      if (before.status !== after.status) {
        const status = String(after.status);
        if (status === StatusSolicitacao.AGUARDANDO_GATE_IN || status === StatusSolicitacao.EM_PATIO) {
          return `${actor} registrou movimentação operacional (${status})${containerSuffix(iso)} na solicitação ${after.protocolo ?? input.entidadeId.slice(0, 8)}.`;
        }
        return `${actor} alterou o status da solicitação ${after.protocolo ?? ''} de ${String(before.status)} para ${status}${containerSuffix(iso)}.`;
      }
      return `${actor} alterou a solicitação ${after.protocolo ?? input.entidadeId.slice(0, 8)}${containerSuffix(iso)}.`;
    }
    case 'SOLICITACAO_EXCLUIDA':
      return `${actor} removeu solicitação ${before.protocolo ?? input.entidadeId.slice(0, 8)}${containerSuffix(iso)}.`;
    case 'PARAMETROS_ATUALIZADOS':
      return `${actor} atualizou os parâmetros gerais do terminal (operacional/financeiro).`;
    case 'CANCELAMENTO_TARDIO': {
      const minutos = Number(after.minutosAntecedencia ?? 0);
      const limite = Number(after.limiteMinutos ?? 120);
      return `${actor} cancelou agendamento com ${Math.round(minutos)} min de antecedência (limite sem penalidade: ${limite} min).`;
    }
    default:
      return `${actor} registrou ${input.acao.replace(/_/g, ' ').toLowerCase()}${containerSuffix(iso)}.`;
  }
}

export function resolveAuditAcao(
  model: AuditedPrismaModel,
  operation: 'update' | 'delete',
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): string {
  if (model === 'Fatura') {
    return operation === 'delete' ? 'FATURA_EXCLUIDA' : 'FATURA_ALTERADA';
  }
  if (model === 'Boleto') {
    return operation === 'delete' ? 'BOLETO_EXCLUIDO' : 'BOLETO_ALTERADO';
  }
  if (model === 'NfsEmitida') {
    return operation === 'delete' ? 'NFSE_EXCLUIDA' : 'NFSE_ALTERADA';
  }
  if (model === 'PreFatura') {
    return operation === 'delete' ? 'PRE_FATURA_EXCLUIDA' : 'PRE_FATURA_ALTERADA';
  }
  if (model === 'Cliente') {
    return operation === 'delete' ? 'CLIENTE_EXCLUIDO' : 'CLIENTE_ALTERADO';
  }
  if (model.startsWith('Cadastro')) {
    return operation === 'delete' ? 'CADASTRO_EXCLUIDO' : 'CADASTRO_ALTERADO';
  }
  if (model === 'BloqueioContainer') {
    if (operation === 'delete') return 'BLOQUEIO_EXCLUIDO';
    if (before?.status === StatusBloqueioContainer.ATIVO && after?.status === StatusBloqueioContainer.LIBERADO) {
      return 'BLOQUEIO_LIBERADO';
    }
    return 'BLOQUEIO_APLICADO';
  }
  if (model === 'Solicitacao') {
    if (operation === 'delete') return 'SOLICITACAO_EXCLUIDA';
    const st = String(after?.status ?? '');
    if (st === StatusSolicitacao.EM_PATIO || st === StatusSolicitacao.AGUARDANDO_GATE_IN) {
      return 'GATE_IN_REALIZADO';
    }
    if (st === StatusSolicitacao.CONCLUIDO || st === StatusSolicitacao.AGUARDANDO_GATE_OUT) {
      return 'GATE_OUT_REALIZADO';
    }
    return 'SOLICITACAO_ALTERADA';
  }
  return operation === 'delete' ? 'REGISTRO_EXCLUIDO' : 'REGISTRO_ALTERADO';
}

export function resolveAuditCategoria(
  model: AuditedPrismaModel,
  acao: string,
  record?: Record<string, unknown> | null,
): CategoriaAuditLog {
  if (
    model === 'Fatura' ||
    model === 'Boleto' ||
    model === 'NfsEmitida' ||
    model === 'PreFatura' ||
    model === 'Cliente'
  ) {
    return CategoriaAuditLog.FINANCEIRO;
  }
  if (model === 'BloqueioContainer') {
    const tipo = String(record?.tipo ?? '');
    if (tipo === TipoBloqueioContainer.FINANCEIRO || tipo === TipoBloqueioContainer.FISCAL) {
      return CategoriaAuditLog.FINANCEIRO;
    }
    return CategoriaAuditLog.OPERACIONAL;
  }
  if (acao.startsWith('GATE_')) return CategoriaAuditLog.OPERACIONAL;
  return CategoriaAuditLog.OPERACIONAL;
}

export function sanitizeAuditPayload(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}
