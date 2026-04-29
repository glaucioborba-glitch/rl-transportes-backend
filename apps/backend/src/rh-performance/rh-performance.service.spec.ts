import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { RhPerformanceStoreService } from './rh-performance-store.service';
import { RhPerformanceService } from './rh-performance.service';

describe('RhPerformanceService', () => {
  let service: RhPerformanceService;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        RhPerformanceService,
        RhPerformanceStoreService,
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

  it('createAvaliacao persiste scoreFinal', () => {
    const r = service.createAvaliacao({
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
