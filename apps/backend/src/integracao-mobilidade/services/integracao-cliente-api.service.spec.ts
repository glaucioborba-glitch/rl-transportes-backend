import { ConfigService } from '@nestjs/config';
import { StatusSolicitacao } from '@prisma/client';
import { IntegracaoClienteApiService } from './integracao-cliente-api.service';
import { IntegracaoEventLogStore } from '../stores/integracao-event-log.store';
import { PrismaService } from '../../prisma/prisma.service';

describe('IntegracaoClienteApiService', () => {
  it('metricsSlas conta dentro/fora do SLA previsto', async () => {
    const prisma = {
      solicitacao: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: '1',
            protocolo: 'P1',
            status: StatusSolicitacao.CONCLUIDO,
            createdAt: new Date('2026-01-01T00:00:00Z'),
            updatedAt: new Date('2026-01-02T00:00:00Z'),
            portaria: null,
            gate: null,
            patio: null,
            saida: null,
          },
          {
            id: '2',
            protocolo: 'P2',
            status: StatusSolicitacao.CONCLUIDO,
            createdAt: new Date('2026-01-01T00:00:00Z'),
            updatedAt: new Date('2026-01-10T00:00:00Z'),
            portaria: null,
            gate: null,
            patio: null,
            saida: null,
          },
        ]),
      },
    } as unknown as PrismaService;

    const config = {
      get: (k: string) => (k === 'INTEGRACAO_SLA_HORAS_PADRAO' ? '48' : undefined),
    } as unknown as ConfigService;

    const events = new IntegracaoEventLogStore();
    const svc = new IntegracaoClienteApiService(prisma, config, events);

    const m = await svc.metricsSlas('cid');
    expect(m.slaPrevistoHoras).toBe(48);
    expect(m.dentroDoSla).toBe(1);
    expect(m.foraDoSla).toBe(1);
  });
});
