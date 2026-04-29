import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { FolhaRhStoreService } from './folha-rh-store.service';
import { FolhaRhService } from './folha-rh.service';

describe('FolhaRhService', () => {
  let service: FolhaRhService;
  let store: FolhaRhStoreService;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        FolhaRhService,
        FolhaRhStoreService,
        {
          provide: ConfigService,
          useValue: {
            get: () => undefined,
          },
        },
      ],
    }).compile();
    service = mod.get(FolhaRhService);
    store = mod.get(FolhaRhStoreService);
  });

  it('getCalculo retorna totais coerentes para um colaborador', () => {
    store.createColaborador({
      nome: 'A',
      cpf: '1',
      cargo: 'x',
      turno: 'MANHA',
      salarioBase: 3300,
      tipoContratacao: 'CLT',
      dataAdmissao: '2024-01-01',
      beneficiosAtivos: [],
    });
    const r = service.getCalculo('2026-05');
    expect(r.porColaborador.length).toBe(1);
    expect(r.custoTotalEmpresa).toBeGreaterThan(r.salarioLiquidoTotal);
  });
});
