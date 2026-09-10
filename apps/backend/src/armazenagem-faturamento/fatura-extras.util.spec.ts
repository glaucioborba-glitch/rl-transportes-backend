import { EventoGatilhoTarifa, StatusFrete } from '@prisma/client';
import { syncExtrasOnPreFatura } from './fatura-extras.util';

describe('syncExtrasOnPreFatura', () => {
  it('grava serviços do ID e frete do quadro na pré-fatura', async () => {
    const createMany = jest.fn();
    const db = {
      itemFaturaArmazenagem: { deleteMany: jest.fn(), createMany },
      unidadeProcessoServico: {
        findMany: jest.fn().mockResolvedValue([
          {
            nome: 'Lavagem',
            codigo: 'LAVAGEM',
            quantidade: 1,
            valorUnitario: 120,
            valorTotal: 120,
          },
        ]),
      },
      frete: {
        findFirst: jest.fn().mockResolvedValue({
          valor: 450,
          tipo: 'IMPORTACAO',
          local: 'Portonave',
          status: StatusFrete.PENDENTE,
          statusCarga: 'CHEIO',
        }),
      },
    };

    await syncExtrasOnPreFatura(db as never, {
      preFaturaId: 'pf1',
      unidadeProcessoId: 'up1',
      clienteId: 'c1',
      tenantId: 'default',
      containerIso: 'GLDU9443335',
    });

    expect(db.itemFaturaArmazenagem.deleteMany).toHaveBeenCalledWith({
      where: {
        preFaturaId: 'pf1',
        eventoGatilho: { in: [EventoGatilhoTarifa.SERVICO_ADICIONAL, EventoGatilhoTarifa.FRETE] },
      },
    });
    expect(createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          eventoGatilho: EventoGatilhoTarifa.SERVICO_ADICIONAL,
          descricao: 'Lavagem (LAVAGEM)',
        }),
        expect.objectContaining({
          eventoGatilho: EventoGatilhoTarifa.FRETE,
          descricao: 'Frete IMPORTACAO — Portonave',
        }),
      ]),
    });
  });

  it('não inventa frete quando não há valor nem trecho', async () => {
    const createMany = jest.fn();
    const db = {
      itemFaturaArmazenagem: { deleteMany: jest.fn(), createMany },
      unidadeProcessoServico: { findMany: jest.fn().mockResolvedValue([]) },
      frete: { findFirst: jest.fn().mockResolvedValue(null) },
      unidadeProcesso: {
        findUnique: jest.fn().mockResolvedValue({
          entradaSolicitacao: { agendamentos: [] },
        }),
      },
    };

    await syncExtrasOnPreFatura(db as never, {
      preFaturaId: 'pf1',
      unidadeProcessoId: 'up1',
      clienteId: 'c1',
      tenantId: 'default',
      containerIso: 'GLDU9443335',
    });

    expect(createMany).not.toHaveBeenCalled();
  });
});
