import { BadRequestException } from '@nestjs/common';
import {
  ModalidadeTransporte,
  StatusCarga,
  TipoOperacaoAgendamento,
} from '@prisma/client';

export const TRANSPORTE_SOLICITADO_EVENT = 'transporte.solicitado';

export type TransporteSolicitadoPayload = {
  agendamentoId: string;
  clienteId: string;
  numeroIso: string;
  tipoOperacao: TipoOperacaoAgendamento;
  modalidadeTransporte: ModalidadeTransporte;
  statusCarga: StatusCarga;
  localOrigem: string | null;
  localDestino: string | null;
  dataRef: string;
  turno: string;
};

export type AgendamentoTransporteInput = {
  tipoOperacao: TipoOperacaoAgendamento;
  modalidadeTransporte?: ModalidadeTransporte;
  statusCarga: StatusCarga;
  localOrigem?: string | null;
  localDestino?: string | null;
  valorFrete?: number | null;
};

export function assertAgendamentoTransporte(input: AgendamentoTransporteInput): void {
  const modalidade = input.modalidadeTransporte ?? ModalidadeTransporte.FROTA_CLIENTE;

  if (modalidade === ModalidadeTransporte.FROTA_FL) {
    if (input.tipoOperacao === TipoOperacaoAgendamento.GATE_IN) {
      if (!input.localOrigem?.trim()) {
        throw new BadRequestException(
          'Local de coleta (origem) é obrigatório quando o transporte é FL (Gate In).',
        );
      }
    }
    if (input.tipoOperacao === TipoOperacaoAgendamento.GATE_OUT) {
      if (!input.localDestino?.trim()) {
        throw new BadRequestException(
          'Local de entrega (destino) é obrigatório quando o transporte é FL (Gate Out).',
        );
      }
    }
  }
}

export function normalizeLocalEndereco(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  return t ? t : null;
}
