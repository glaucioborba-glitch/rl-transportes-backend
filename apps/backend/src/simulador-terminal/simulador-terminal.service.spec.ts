import { ConfigService } from '@nestjs/config';
import { SimuladorTerminalService } from './simulador-terminal.service';

describe('SimuladorTerminalService', () => {
  it('getExpansao compõe resultado quando baseline é obtido sem DB real', async () => {
    const prisma = {} as never;
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'SIMULADOR_CUSTO_EXPANSAO_M2_PROXY') return '800';
        if (key === 'SIMULADOR_MARGEM_OPER_SLOT_PROXY') return '100';
        if (key === 'SIMULADOR_M2_POR_SLOT_PROXY') return '36';
        return undefined;
      }),
    } as unknown as ConfigService;

    const svc = new SimuladorTerminalService(prisma, config);
    jest.spyOn(svc, 'getCapacidadeAtual').mockResolvedValue({
      capacidadePatioSlotsTotal: 100,
      ocupacaoAtualUnidades: 60,
      fatorSaturacaoPct: 60,
      capacidadeGateUnidadesPorHoraMedia: 2,
      capacidadeGateUnidadesPorHoraPico: 3,
      capacidadePortariaUnidadesPorHoraMedia: 2,
      capacidadePortariaUnidadesPorHoraPico: 3,
      cicloMedioMinutos: 150,
      quadrasDistintas: 2,
      slotsPorQuadraEstimado: 50,
      periodoReferenciaDias: 30,
    });

    const out = await svc.getExpansao({ quadrasAdicionais: 1, slotsPorQuadraEstimado: 50 });
    expect(out.ganhoSlots).toBe(50);
    expect(out.novaCapacidadeTotalSlots).toBe(150);
    expect(out.saturacaoAposExpansaoPct).toBeLessThan(out.saturacaoAtualPct);
  });
});
