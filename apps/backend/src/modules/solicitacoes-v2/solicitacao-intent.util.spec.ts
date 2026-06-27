import { BadRequestException } from '@nestjs/common';
import {
  ModalidadeTransporte,
  TipoOperacaoAgendamento,
  TipoOperacaoSolicitacaoIntent,
} from '@prisma/client';
import { resolveAgendamentoFromTipoOperacao } from './solicitacao-intent.util';

describe('solicitacao-intent.util', () => {
  it('mapeia baixa para GATE_OUT + FROTA_CLIENTE', () => {
    const r = resolveAgendamentoFromTipoOperacao(TipoOperacaoSolicitacaoIntent.SOLICITAR_BAIXA);
    expect(r.tipoOperacao).toBe(TipoOperacaoAgendamento.GATE_OUT);
    expect(r.modalidadeTransporte).toBe(ModalidadeTransporte.FROTA_CLIENTE);
    expect(r.exigeTransporteCliente).toBe(true);
  });

  it('mapeia coleta para GATE_IN + FROTA_CLIENTE', () => {
    const r = resolveAgendamentoFromTipoOperacao(TipoOperacaoSolicitacaoIntent.SOLICITAR_COLETA);
    expect(r.tipoOperacao).toBe(TipoOperacaoAgendamento.GATE_IN);
    expect(r.modalidadeTransporte).toBe(ModalidadeTransporte.FROTA_CLIENTE);
    expect(r.exigeTransporteCliente).toBe(true);
  });

  it('mapeia importação depot para GATE_IN + FROTA_FL com origem', () => {
    const r = resolveAgendamentoFromTipoOperacao(
      TipoOperacaoSolicitacaoIntent.SOLICITAR_IMPORTACAO_COLETA_DEPOT,
    );
    expect(r.tipoOperacao).toBe(TipoOperacaoAgendamento.GATE_IN);
    expect(r.modalidadeTransporte).toBe(ModalidadeTransporte.FROTA_FL);
    expect(r.exigeLocalOrigem).toBe(true);
    expect(r.exigeTransporteCliente).toBe(false);
  });

  it('mapeia exportação depot para GATE_OUT + FROTA_FL com destino', () => {
    const r = resolveAgendamentoFromTipoOperacao(
      TipoOperacaoSolicitacaoIntent.SOLICITAR_EXPORTACAO_ENTREGA_DEPOT,
    );
    expect(r.tipoOperacao).toBe(TipoOperacaoAgendamento.GATE_OUT);
    expect(r.modalidadeTransporte).toBe(ModalidadeTransporte.FROTA_FL);
    expect(r.exigeLocalDestino).toBe(true);
  });

  it('rejeita intent desconhecido', () => {
    expect(() =>
      resolveAgendamentoFromTipoOperacao('INVALID' as TipoOperacaoSolicitacaoIntent),
    ).toThrow(BadRequestException);
  });
});
