import { CockpitIndicadoresService } from './cockpit-indicadores.service';

describe('CockpitIndicadoresService', () => {
  it('resumo não quebra com base vazia', async () => {
    const prisma = {
      gate: { count: jest.fn().mockResolvedValue(0) },
      saida: { count: jest.fn().mockResolvedValue(0) },
      patio: { findMany: jest.fn().mockResolvedValue([]) },
      solicitacao: { groupBy: jest.fn().mockResolvedValue([]) },
    };
    const config = { get: () => undefined };
    const ops = { ultimos: jest.fn().mockReturnValue([]) };
    const svc = new CockpitIndicadoresService(prisma as never, config as never, ops as never);
    const r = await svc.resumo();
    expect(r.throughput.gateInPorHora).toBe(0);
    expect(r.patio.ocupacaoPct).toBe(0);
  });
});
