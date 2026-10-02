import { BadRequestException } from '@nestjs/common';
import {
  ModalidadeTransporte,
  StatusCarga,
  TipoOperacaoAgendamento,
} from '@prisma/client';
import { assertAgendamentoTransporte } from './agendamento-transporte.util';

describe('agendamento-transporte.util', () => {
  it('exige origem para FROTA_FL no Gate In', () => {
    expect(() =>
      assertAgendamentoTransporte({
        tipoOperacao: TipoOperacaoAgendamento.GATE_IN,
        modalidadeTransporte: ModalidadeTransporte.FROTA_FL,
        statusCarga: StatusCarga.CHEIO,
        localOrigem: '',
      }),
    ).toThrow(BadRequestException);
  });

  it('exige destino para FROTA_FL no Gate Out', () => {
    expect(() =>
      assertAgendamentoTransporte({
        tipoOperacao: TipoOperacaoAgendamento.GATE_OUT,
        modalidadeTransporte: ModalidadeTransporte.FROTA_FL,
        statusCarga: StatusCarga.VAZIO,
        localDestino: null,
      }),
    ).toThrow(BadRequestException);
  });

  it('permite FROTA_CLIENTE sem origem/destino', () => {
    expect(() =>
      assertAgendamentoTransporte({
        tipoOperacao: TipoOperacaoAgendamento.GATE_IN,
        modalidadeTransporte: ModalidadeTransporte.FROTA_CLIENTE,
        statusCarga: StatusCarga.CHEIO,
      }),
    ).not.toThrow();
  });
});
