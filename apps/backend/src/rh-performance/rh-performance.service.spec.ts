import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { RhPerformanceStoreService } from './rh-performance-store.service';
import { RhPerformanceService } from './rh-performance.service';

describe('RhPerformanceService', () => {
  let service: RhPerformanceService;
  let store: jest.Mocked<RhPerformanceStoreService>;

  beforeEach(async () => {
    store = {
      createAvaliacao: jest.fn(async (input) => ({
        ...input,
        id: 'a1',
        createdAt: new Date().toISOString(),
      })),
      listAvaliacoes: jest.fn(async () => []),
      createOkr: jest.fn(),
      listOkrs: jest.fn(async () => []),
      createTreinamento: jest.fn(),
      listTreinamentos: jest.fn(async () => []),
      treinamentosPorColaborador: jest.fn(async () => []),
    } as unknown as jest.Mocked<RhPerformanceStoreService>;

    const mod = await Test.createTestingModule({
      providers: [
        RhPerformanceService,
        { provide: RhPerformanceStoreService, useValue: store },
        {
          provide: ConfigService,
          useValue: {
            get: () => undefined,
          },
        },
      ],
    }).compile();
    service = mod.get(RhPerformanceService);
  });

  it('createAvaliacao persiste scoreFinal', async () => {
    const r = await service.createAvaliacao({
      colaboradorId: 'x',
      periodo: '2026-06',
      avaliador: 'Gestor',
      notaTecnica: 8,
      notaComportamental: 8,
      aderenciaProcedimentos: 8,
      qualidadeExecucao: 8,
      comprometimento: 8,
    });
    expect(r.scoreFinal).toBe(8);
  });
});
