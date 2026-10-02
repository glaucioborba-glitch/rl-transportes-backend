import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { TesourariaStoreService } from './tesouraria-store.service';
import { TesourariaService } from './tesouraria.service';

describe('TesourariaService', () => {
  let service: TesourariaService;
  let store: jest.Mocked<TesourariaStoreService>;

  beforeEach(async () => {
    store = {
      createFornecedor: jest.fn(),
      listFornecedores: jest.fn().mockResolvedValue([]),
      getFornecedor: jest.fn(),
      createDespesa: jest.fn(),
      listDespesas: jest.fn().mockResolvedValue([]),
      getDespesa: jest.fn(),
      createContrato: jest.fn(),
      listContratos: jest.fn().mockResolvedValue([]),
      getContrato: jest.fn(),
    } as unknown as jest.Mocked<TesourariaStoreService>;

    const mod = await Test.createTestingModule({
      providers: [
        TesourariaService,
        { provide: TesourariaStoreService, useValue: store },
        {
          provide: ConfigService,
          useValue: {
            get: (k: string) =>
              ({
                FINANCEIRO_CUSTOS_FIXOS_MENSAL: '30000',
                FINANCEIRO_SALDO_CONTA_PROXY: '100000',
                FINANCEIRO_SAIDAS_COMPROMETIDAS_MES: '0',
                FINANCEIRO_RECUPERACAO_BOLETOS_PROXY: '0.65',
              })[k],
          },
        },
        {
          provide: PrismaService,
          useValue: {
            boleto: {
              findMany: jest.fn().mockResolvedValue([]),
            },
          },
        },
      ],
    }).compile();

    service = mod.get(TesourariaService);
  });

  it('createContrato exige fornecedor existente', async () => {
    store.getFornecedor.mockResolvedValue(undefined);
    await expect(
      service.createContrato({
        fornecedorId: 'inexistente',
        tipoContrato: 'mensal',
        valorFixo: 1,
        vigenciaInicio: '2026-01-01',
        vigenciaFim: '2026-12-31',
        reajusteAnualPct: 0,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('createContrato aceita após cadastrar fornecedor', async () => {
    const f = {
      id: 'f1',
      nome: 'F',
      cnpj: '123',
      categoriaFornecedor: 'geral' as const,
      contato: 'x',
      prazoPagamentoPadrao: 30,
      createdAt: new Date().toISOString(),
    };
    store.getFornecedor.mockResolvedValue(f);
    store.createContrato.mockResolvedValue({
      id: 'c1',
      fornecedorId: f.id,
      tipoContrato: 'mensal',
      valorFixo: 100,
      vigenciaInicio: '2026-01-01',
      vigenciaFim: '2026-12-31',
      reajusteAnualPct: 2,
      createdAt: new Date().toISOString(),
    });

    const c = await service.createContrato({
      fornecedorId: f.id,
      tipoContrato: 'mensal',
      valorFixo: 100,
      vigenciaInicio: '2026-01-01',
      vigenciaFim: '2026-12-31',
      reajusteAnualPct: 2,
    });
    expect(c.fornecedorId).toBe(f.id);
  });
});
