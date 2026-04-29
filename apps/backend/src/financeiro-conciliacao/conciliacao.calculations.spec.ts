import { motorConciliacaoAutomatica } from './conciliacao.calculations';
import type { ExtratoLinhaNormalizada } from './extrato-parser';

describe('conciliacao.calculations', () => {
  it('concilia por valor exato', () => {
    const linhas: ExtratoLinhaNormalizada[] = [
      {
        idLinha: 'b:0',
        batchId: 'b',
        indice: 0,
        dataLancamento: '2026-04-01',
        historico: 'PIX',
        valor: 100,
        tipo: 'CREDITO',
      },
    ];
    const boletos = [
      {
        id: 'bol1',
        faturamentoId: 'fat1',
        numeroBoleto: '999',
        valorBoleto: 100,
        statusPagamento: 'PAGO',
        dataVencimento: new Date(),
      },
    ];
    const r = motorConciliacaoAutomatica(linhas, boletos, new Map());
    expect(r.conciliados.length).toBe(1);
    expect(r.conciliados[0]?.boletoId).toBe('bol1');
  });

  it('manual prevalece', () => {
    const linhas: ExtratoLinhaNormalizada[] = [
      {
        idLinha: 'x:0',
        batchId: 'x',
        indice: 0,
        dataLancamento: '2026-04-01',
        historico: 'x',
        valor: 50,
        tipo: 'CREDITO',
      },
    ];
    const boletos = [
      {
        id: 'b2',
        faturamentoId: 'f2',
        numeroBoleto: '1',
        valorBoleto: 50,
        statusPagamento: 'PAGO',
        dataVencimento: new Date(),
      },
    ];
    const manual = new Map([['x:0', { boletoId: 'b2', faturamentoId: 'f2' }]]);
    const r = motorConciliacaoAutomatica(linhas, boletos, manual);
    expect(r.conciliados[0]?.motivo).toContain('manual');
  });
});
