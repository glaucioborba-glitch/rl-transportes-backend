import { UnprocessableEntityException } from '@nestjs/common';
import { BillingRuleEngineService } from './billing-rule-engine.service';

describe('BillingRuleEngineService.resolvePricingForCliente', () => {
  function service(prisma: Record<string, unknown>) {
    return new BillingRuleEngineService(prisma as never, { getParametros: jest.fn() } as never);
  }

  it('falha se não houver tabela padrão do terminal', async () => {
    const prisma = {
      cadastroTabelaPreco: { findMany: jest.fn().mockResolvedValue([]) },
      cliente: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({ tabelaPrecoId: null, tenantId: 'default' })
          .mockResolvedValueOnce({ id: 'c1', tenantId: 'default', tabelaPreco: null }),
      },
      tabelaPreco: { findFirst: jest.fn().mockResolvedValue(null) },
    };

    await expect(service(prisma).resolvePricingForCliente('c1')).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('usa a tabela padrão do cadastro quando o cliente não tem tabela própria', async () => {
    const regras = [{ id: 'r1', ativa: true }];
    const prisma = {
      cadastroTabelaPreco: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'cad-padrao',
            padrao: true,
            billingTabelaPrecoId: 'tp-padrao',
            clienteId: null,
            itens: [],
          },
        ]),
      },
      cliente: {
        findFirst: jest.fn().mockResolvedValue({ tabelaPrecoId: null, tenantId: 'default' }),
      },
      tabelaPreco: {
        findFirst: jest.fn().mockResolvedValue({ id: 'tp-padrao', ativa: true, regras }),
      },
    };

    await expect(service(prisma).resolvePricingForCliente('c1')).resolves.toEqual({
      source: 'TABELA_PRECO',
      tabelaPrecoId: 'tp-padrao',
      regras,
    });
  });
});

describe('BillingRuleEngineService.resolveTarifaDiaria', () => {
  function service(prisma: Record<string, unknown>) {
    return new BillingRuleEngineService(prisma as never, { getParametros: jest.fn() } as never);
  }

  it('usa faixa da matriz quando a RIC traz DRY 40 CHEIO e não há diária flat', async () => {
    const { StatusContainerTarifa } = await import('@prisma/client');
    const prisma = {
      cliente: {
        findFirst: jest.fn().mockResolvedValue({ tabelaPrecoId: null, tenantId: 'default' }),
      },
      cadastroTabelaPreco: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'cad-padrao',
            padrao: true,
            billingTabelaPrecoId: 'tp-padrao',
            clienteId: null,
            itens: [
              {
                categoriaItem: 'ARMAZENAGEM',
                tipoOperacaoCodigo: 'ARMAZENAGEM',
                tipoContainerCodigo: 'DRY',
                capacidadeCodigo: null,
                containerTamanho: "40'",
                statusContainer: StatusContainerTarifa.CHEIO,
                freeTimeDias: 7,
                faixasDiaria: [
                  { diaInicio: 8, diaFim: 15, valorDiaria: 30 },
                  { diaInicio: 16, diaFim: null, valorDiaria: 45 },
                ],
                tarifaDiariaArmazenagem: null,
                tarifaEnergiaReeferDiaria: null,
                valorHandling: 300,
              },
            ],
          },
        ]),
      },
    };

    await expect(
      service(prisma).resolveTarifaDiaria(
        'default',
        'c1',
        { tipo: 'DRY', tamanho: "40'", statusContainer: StatusContainerTarifa.CHEIO },
        [],
      ),
    ).resolves.toBe(30);
  });
});
