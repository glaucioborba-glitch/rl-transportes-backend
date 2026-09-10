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
