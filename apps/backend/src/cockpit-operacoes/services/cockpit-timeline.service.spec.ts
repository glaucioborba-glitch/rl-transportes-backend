import { CockpitTimelineService } from './cockpit-timeline.service';

describe('CockpitTimelineService', () => {
  it('fluxo monta etapas na ordem esperada', async () => {
    const prisma = {
      solicitacao: {
        findMany: jest.fn().mockResolvedValue([
          {
            protocolo: 'P1',
            status: 'APROVADO',
            updatedAt: new Date(),
            cliente: { nome: 'C' },
            portaria: { createdAt: new Date('2026-01-01T10:00:00Z') },
            gate: { updatedAt: new Date('2026-01-01T11:00:00Z') },
            patio: { updatedAt: new Date('2026-01-02T12:00:00Z') },
            saida: { dataHoraSaida: new Date('2026-01-02T14:00:00Z') },
          },
        ]),
      },
    };
    const config = { get: () => '72' } as never;
    const svc = new CockpitTimelineService(prisma as never, config);
    const r = await svc.fluxo(10);
    expect(r.ciclos).toHaveLength(1);
    expect(r.ciclos[0].cicloCompleto).toBe(true);
    expect(r.ciclos[0].etapas.map((e) => e.etapa)).toEqual([
      'portaria',
      'gate_in',
      'patio',
      'gate_out',
    ]);
  });
});
