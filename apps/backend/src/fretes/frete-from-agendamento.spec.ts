import {
  ModalidadeTransporte,
  StatusCarga,
  TipoFrete,
  TipoOperacaoAgendamento,
  TurnoAgendamento,
} from '@prisma/client';
import {
  clienteNomeFrete,
  freteUncheckedCreateFromAgendamento,
  localFreteFrom,
  tipoFreteFrom,
} from './frete-from-agendamento';

describe('frete-from-agendamento', () => {
  it('mapeia IMP / EXP / vazios a partir do gate + carga', () => {
    expect(tipoFreteFrom(TipoOperacaoAgendamento.GATE_IN, StatusCarga.CHEIO)).toBe(TipoFrete.IMP);
    expect(tipoFreteFrom(TipoOperacaoAgendamento.GATE_OUT, StatusCarga.CHEIO)).toBe(TipoFrete.EXP);
    expect(tipoFreteFrom(TipoOperacaoAgendamento.GATE_IN, StatusCarga.VAZIO)).toBe(
      TipoFrete.RETIRADA_VAZIO,
    );
    expect(tipoFreteFrom(TipoOperacaoAgendamento.GATE_OUT, StatusCarga.VAZIO)).toBe(
      TipoFrete.DEVOLUCAO_VAZIO,
    );
  });

  it('usa origem na entrada e destino na saída', () => {
    expect(
      localFreteFrom(TipoOperacaoAgendamento.GATE_IN, 'PORTONAVE', 'FL'),
    ).toBe('PORTONAVE');
    expect(
      localFreteFrom(TipoOperacaoAgendamento.GATE_OUT, 'FL', 'JBS ITAJAI'),
    ).toBe('JBS ITAJAI');
  });

  it('prefere nome fantasia no quadro', () => {
    expect(clienteNomeFrete({ razaoSocial: 'Serrabras Ltda', nomeFantasia: 'SERRABRAS' })).toBe(
      'SERRABRAS',
    );
  });

  it('monta create a partir do agendamento FROTA_FL', () => {
    const data = freteUncheckedCreateFromAgendamento(
      {
        id: 'ag-1',
        tenantId: 'default',
        dataRef: new Date('2026-09-03T12:00:00.000Z'),
        turno: TurnoAgendamento.MANHA,
        numeroIso: 'TGBU6084982',
        statusCarga: StatusCarga.CHEIO,
        tipoOperacao: TipoOperacaoAgendamento.GATE_OUT,
        modalidadeTransporte: ModalidadeTransporte.FROTA_FL,
        localDestino: 'JBS ITAJAI',
        clienteId: 'c1',
        cliente: { razaoSocial: 'Serrabras Ltda', nomeFantasia: 'SERRABRAS' },
        solicitacaoId: 'sol-1',
      },
      'BK-1',
    );
    expect(data.tipo).toBe(TipoFrete.EXP);
    expect(data.local).toBe('JBS ITAJAI');
    expect(data.clienteNome).toBe('SERRABRAS');
    expect(data.agendamentoId).toBe('ag-1');
    expect(data.booking).toBe('BK-1');
  });
});
