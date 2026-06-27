import { BadRequestException } from '@nestjs/common';
import {
  ModalidadeTransporte,
  TipoCaminhao,
  TipoOperacaoAgendamento,
  TipoOperacaoSolicitacaoIntent,
} from '@prisma/client';
import type { TransporteV2Dto } from './dto/create-solicitacao-v2.dto';

export { TipoOperacaoSolicitacaoIntent };

export type ResolvedAgendamentoIntent = {
  tipoOperacao: TipoOperacaoAgendamento;
  modalidadeTransporte: ModalidadeTransporte;
  exigeTransporteCliente: boolean;
  exigeLocalOrigem: boolean;
  exigeLocalDestino: boolean;
};

export function exigeTransporteClienteIntent(intent: TipoOperacaoSolicitacaoIntent): boolean {
  return resolveAgendamentoFromTipoOperacao(intent).exigeTransporteCliente;
}

export function resolveAgendamentoFromTipoOperacao(
  intent: TipoOperacaoSolicitacaoIntent,
): ResolvedAgendamentoIntent {
  switch (intent) {
    case TipoOperacaoSolicitacaoIntent.SOLICITAR_BAIXA:
      return {
        tipoOperacao: TipoOperacaoAgendamento.GATE_OUT,
        modalidadeTransporte: ModalidadeTransporte.FROTA_CLIENTE,
        exigeTransporteCliente: true,
        exigeLocalOrigem: false,
        exigeLocalDestino: false,
      };
    case TipoOperacaoSolicitacaoIntent.SOLICITAR_COLETA:
      return {
        tipoOperacao: TipoOperacaoAgendamento.GATE_IN,
        modalidadeTransporte: ModalidadeTransporte.FROTA_CLIENTE,
        exigeTransporteCliente: true,
        exigeLocalOrigem: false,
        exigeLocalDestino: false,
      };
    case TipoOperacaoSolicitacaoIntent.SOLICITAR_IMPORTACAO_COLETA_DEPOT:
      return {
        tipoOperacao: TipoOperacaoAgendamento.GATE_IN,
        modalidadeTransporte: ModalidadeTransporte.FROTA_FL,
        exigeTransporteCliente: false,
        exigeLocalOrigem: true,
        exigeLocalDestino: false,
      };
    case TipoOperacaoSolicitacaoIntent.SOLICITAR_EXPORTACAO_ENTREGA_DEPOT:
      return {
        tipoOperacao: TipoOperacaoAgendamento.GATE_OUT,
        modalidadeTransporte: ModalidadeTransporte.FROTA_FL,
        exigeTransporteCliente: false,
        exigeLocalOrigem: false,
        exigeLocalDestino: true,
      };
    default:
      throw new BadRequestException('tipoOperacao inválido');
  }
}

/** Placeholder interno quando a frota FL assume o transporte (intent B/D). */
export function buildTransportePlaceholderFl(): TransporteV2Dto {
  return {
    nomeMotorista: 'Transporte Frota FL',
    cpfMotorista: '00000000000',
    tipoCaminhao: TipoCaminhao.LS,
    placaCavalo: 'FLA0A00',
    placaCarreta01: 'FLB0B00',
  };
}
