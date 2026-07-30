import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { FolhaRhStoreService } from './folha-rh-store.service';
import { FolhaRhService } from './folha-rh.service';

describe('FolhaRhService', () => {
  let service: FolhaRhService;
  let store: jest.Mocked<FolhaRhStoreService>;

  beforeEach(async () => {
    const colaboradores: Awaited<ReturnType<FolhaRhStoreService['listColaboradores']>> = [];
    store = {
      createColaborador: jest.fn(async (input) => {
        const e = {
          ...input,
          id: 'c1',
          createdAt: new Date().toISOString(),
        };
        colaboradores.push(e);
        return e;
      }),
      listColaboradores: jest.fn(async () => colaboradores),
      getColaborador: jest.fn(async (id) => colaboradores.find((c) => c.id === id)),
      createBeneficio: jest.fn(),
      listBeneficios: jest.fn(async () => []),
      createPresenca: jest.fn(),
      listPresencas: jest.fn(async () => []),
      presencasDoMes: jest.fn(async () => []),
    } as unknown as jest.Mocked<FolhaRhStoreService>;

    const mod = await Test.createTestingModule({
      providers: [
        FolhaRhService,
        { provide: FolhaRhStoreService, useValue: store },
        {
          provide: ConfigService,
          useValue: {
            get: () => undefined,
          },
        },
      ],
    }).compile();

    service = mod.get(FolhaRhService);
  });

  it('getCalculo retorna totais coerentes para um colaborador', async () => {
    await store.createColaborador({
      nome: 'A',
      cpf: '1',
      cargo: 'x',
      turno: 'MANHA',
      salarioBase: 3300,
      tipoContratacao: 'CLT',
      dataAdmissao: '2024-01-01',
      beneficiosAtivos: [],
    });
    const r = await service.getCalculo('2026-05');
    expect(r.porColaborador.length).toBe(1);
    expect(r.custoTotalEmpresa).toBeGreaterThan(r.salarioLiquidoTotal);
  });
});
