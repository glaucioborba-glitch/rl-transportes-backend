import { EventoGatilhoTarifa } from '@prisma/client';
import {
  evaluateAluguelCycle,
  matchAluguelItem,
  normalizeTamanhoAluguel,
} from './aluguel-pricing.util';

const item = {
  tipoContainerCodigo: 'DRYDC',
  containerTamanho: "40'",
  valorDiaria: 80,
  diasFreeTime: 0,
  valorEntrega: 150,
  valorColeta: 120,
  ativo: true,
};

describe('aluguel-pricing.util', () => {
  it('normaliza tamanho com aspas', () => {
    expect(normalizeTamanhoAluguel('40')).toBe("40'");
    expect(normalizeTamanhoAluguel("40'")).toBe("40'");
  });

  it('casa item por tipo e tamanho', () => {
    const hit = matchAluguelItem(
      [item, { ...item, tipoContainerCodigo: 'REEFER', valorDiaria: 200 }],
      'DRYDC',
      '40',
    );
    expect(hit?.valorDiaria).toBe(80);
  });

  it('cobra entrega no início sem diária no mesmo instante', () => {
    const inicio = new Date('2026-09-08T12:00:00.000Z');
    const result = evaluateAluguelCycle({
      iniciadoEm: inicio,
      asOf: inicio,
      item,
      container: { tipo: 'DRYDC', tamanho: '40' },
      fase: 'INICIO',
    });
    expect(result.items.some((i) => i.eventoGatilho === EventoGatilhoTarifa.GATE_IN)).toBe(true);
    expect(result.items.some((i) => i.eventoGatilho === EventoGatilhoTarifa.DIARIA_ARMAZENAGEM)).toBe(
      false,
    );
    expect(result.valorTotal).toBe(150);
  });

  it('cobra diária só com override, sem tabela de pátio', () => {
    const result = evaluateAluguelCycle({
      iniciadoEm: new Date('2026-09-01T12:00:00.000Z'),
      asOf: new Date('2026-09-04T12:00:00.000Z'),
      item: { ...item, valorEntrega: 0, valorColeta: 0 },
      container: { tipo: 'DRYDC', tamanho: '40' },
      fase: 'DIARIA',
    });
    const diaria = result.items.find((i) => i.eventoGatilho === EventoGatilhoTarifa.DIARIA_ARMAZENAGEM);
    expect(diaria?.valorUnitario).toBe(80);
    expect(diaria?.quantidade).toBe(3);
    expect(diaria?.descricao).toMatch(/aluguel/i);
  });

  it('na devolução no mesmo dia cobra no mínimo 1 diária + coleta', () => {
    const inicio = new Date('2026-09-08T08:00:00.000Z');
    const result = evaluateAluguelCycle({
      iniciadoEm: inicio,
      asOf: new Date('2026-09-08T18:00:00.000Z'),
      item,
      container: { tipo: 'DRYDC', tamanho: '40' },
      fase: 'DEVOLUCAO',
    });
    expect(result.diasFaturaveis).toBeGreaterThanOrEqual(1);
    expect(result.items.some((i) => i.eventoGatilho === EventoGatilhoTarifa.GATE_OUT)).toBe(true);
    expect(result.valorTotal).toBeGreaterThanOrEqual(200);
  });
});
