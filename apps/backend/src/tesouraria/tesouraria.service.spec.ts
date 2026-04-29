import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { TesourariaStoreService } from './tesouraria-store.service';
import { TesourariaService } from './tesouraria.service';

describe('TesourariaService', () => {
  let service: TesourariaService;
  let store: TesourariaStoreService;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        TesourariaService,
        TesourariaStoreService,
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
    store = mod.get(TesourariaStoreService);
  });

  it('createContrato exige fornecedor existente', () => {
    expect(() =>
      service.createContrato({
        fornecedorId: 'inexistente',
        tipoContrato: 'mensal',
        valorFixo: 1,
        vigenciaInicio: '2026-01-01',
        vigenciaFim: '2026-12-31',
        reajusteAnualPct: 0,
      }),
    ).toThrow(BadRequestException);
  });

  it('createContrato aceita após cadastrar fornecedor', () => {
    const f = store.createFornecedor({
      nome: 'F',
      cnpj: '123',
      categoriaFornecedor: 'geral',
      contato: 'x',
      prazoPagamentoPadrao: 30,
    });
    const c = service.createContrato({
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
