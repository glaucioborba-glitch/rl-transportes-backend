import {
  ModalidadeTransporte,
  Prisma,
  StatusCarga,
  TipoFrete,
  TipoOperacaoAgendamento,
  TurnoAgendamento,
} from '@prisma/client';

export function tipoFreteFrom(
  tipoOperacao: TipoOperacaoAgendamento,
  statusCarga: StatusCarga,
): TipoFrete {
  const cheio = statusCarga === StatusCarga.CHEIO;
  if (tipoOperacao === TipoOperacaoAgendamento.GATE_IN) {
    return cheio ? TipoFrete.IMP : TipoFrete.RETIRADA_VAZIO;
  }
  return cheio ? TipoFrete.EXP : TipoFrete.DEVOLUCAO_VAZIO;
}

export function localFreteFrom(
  tipoOperacao: TipoOperacaoAgendamento,
  localOrigem?: string | null,
  localDestino?: string | null,
): string | null {
  const raw =
    tipoOperacao === TipoOperacaoAgendamento.GATE_IN ? localOrigem : localDestino;
  const trimmed = raw?.trim() || '';
  return trimmed || null;
}

export function clienteNomeFrete(cliente: {
  nomeFantasia?: string | null;
  razaoSocial: string;
}): string {
  const fantasia = cliente.nomeFantasia?.trim();
  return fantasia || cliente.razaoSocial.trim();
}

export type FreteAgendamentoSource = {
  id: string;
  tenantId: string;
  dataRef: Date;
  turno: TurnoAgendamento;
  numeroIso: string;
  statusCarga: StatusCarga;
  tipoOperacao: TipoOperacaoAgendamento;
  modalidadeTransporte: ModalidadeTransporte;
  localOrigem?: string | null;
  localDestino?: string | null;
  valorFrete?: Prisma.Decimal | number | null;
  solicitacaoId?: string | null;
  clienteId: string;
  cliente: { nomeFantasia?: string | null; razaoSocial: string };
};

export function freteUncheckedCreateFromAgendamento(
  ag: FreteAgendamentoSource,
  booking?: string | null,
  tenantId?: string,
): Prisma.FreteUncheckedCreateInput {
  const valor =
    ag.valorFrete == null
      ? null
      : typeof ag.valorFrete === 'number'
        ? ag.valorFrete
        : Number(ag.valorFrete);

  return {
    tenantId: tenantId || ag.tenantId || 'default',
    dataRef: ag.dataRef,
    turno: ag.turno,
    numeroIso: ag.numeroIso,
    statusCarga: ag.statusCarga,
    tipo: tipoFreteFrom(ag.tipoOperacao, ag.statusCarga),
    local: localFreteFrom(ag.tipoOperacao, ag.localOrigem, ag.localDestino),
    clienteId: ag.clienteId,
    clienteNome: clienteNomeFrete(ag.cliente),
    valor: valor != null && Number.isFinite(valor) ? valor : null,
    booking: booking?.trim() || null,
    solicitacaoId: ag.solicitacaoId ?? null,
    agendamentoId: ag.id,
  };
}
