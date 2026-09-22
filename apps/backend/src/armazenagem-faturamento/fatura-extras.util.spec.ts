import { EventoGatilhoTarifa, StatusFrete } from '@prisma/client';
import { syncExtrasOnPreFatura } from './fatura-extras.util';

function dbBase(createMany: jest.Mock, extras?: { handlingExistente?: boolean }) {
  return {
    itemFaturaArmazenagem: {
      deleteMany: jest.fn(),
      createMany,
      findFirst: jest.fn().mockResolvedValue(extras?.handlingExistente ? { id: 'h1' } : null),
    },
    unidadeProcessoServico: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    frete: { findFirst: jest.fn().mockResolvedValue(null) },
    unidadeProcesso: {
      findUnique: jest.fn().mockResolvedValue({
        entradaSolicitacao: { agendamentos: [] },
      }),
    },
  };
}

describe('syncExtrasOnPreFatura', () => {
  it('grava extras do ID, frete e handling automático da tabela na pré-fatura', async () => {
    const createMany = jest.fn();
    const db = dbBase(createMany);
    db.unidadeProcessoServico.findMany.mockResolvedValue([
      {
        nome: 'Lavagem',
        codigo: 'LAVAGEM',
        quantidade: 1,
        valorUnitario: 120,
        valorTotal: 120,
      },
      {
        nome: 'Handling',
        codigo: 'HANDLING',
        quantidade: 1,
        valorUnitario: 180,
        valorTotal: 180,
        payload: { automatico: true, origem: 'TABELA_PRECO' },
      },
    ]);
    db.frete.findFirst.mockResolvedValue({
      valor: 450,
      tipo: 'IMPORTACAO',
      local: 'Portonave',
      status: StatusFrete.PENDENTE,
      statusCarga: 'CHEIO',
    });

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
        expect.objectContaining({
          eventoGatilho: EventoGatilhoTarifa.HANDLING,
          descricao: 'Handling',
        }),
      ]),
    });
    expect(createMany.mock.calls[0][0].data).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ descricao: 'Handling (HANDLING)' }),
      ]),
    );
  });

  it('não duplica handling se a pré-fatura já tem a linha', async () => {
    const createMany = jest.fn();
    const db = dbBase(createMany, { handlingExistente: true });
    db.unidadeProcessoServico.findMany.mockResolvedValue([
      {
        nome: 'Handling',
        codigo: 'HANDLING',
        quantidade: 1,
        valorUnitario: 180,
        valorTotal: 180,
        payload: { automatico: true, origem: 'TABELA_PRECO' },
      },
    ]);

    await syncExtrasOnPreFatura(db as never, {
      preFaturaId: 'pf1',
      unidadeProcessoId: 'up1',
      clienteId: 'c1',
      tenantId: 'default',
      containerIso: 'GLDU9443335',
    });

    expect(createMany).not.toHaveBeenCalled();
  });

  it('não inventa frete quando não há valor nem trecho', async () => {
    const createMany = jest.fn();
    const db = dbBase(createMany);

    await syncExtrasOnPreFatura(db as never, {
      preFaturaId: 'pf1',
      unidadeProcessoId: 'up1',
      clienteId: 'c1',
      tenantId: 'default',
      containerIso: 'GLDU9443335',
    });

    expect(createMany).not.toHaveBeenCalled();
  });

  it('remove handling excluído da pré-fatura e mantém extras', async () => {
    const createMany = jest.fn();
    const db = dbBase(createMany, { handlingExistente: true });
    db.unidadeProcessoServico.findMany.mockResolvedValue([
      {
        nome: 'Lavagem',
        codigo: 'LAVAGEM',
        quantidade: 1,
        valorUnitario: 120,
        valorTotal: 120,
      },
      {
        nome: 'Handling',
        codigo: 'HANDLING',
        quantidade: 1,
        valorUnitario: 300,
        valorTotal: 300,
        payload: { automatico: true, origem: 'TABELA_PRECO', cobranca: 'HANDLING', excluido: true },
      },
    ]);

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
        eventoGatilho: EventoGatilhoTarifa.HANDLING,
      },
    });
    expect(createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          eventoGatilho: EventoGatilhoTarifa.SERVICO_ADICIONAL,
          descricao: 'Lavagem (LAVAGEM)',
        }),
      ],
    });
    expect(createMany.mock.calls[0][0].data).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ eventoGatilho: EventoGatilhoTarifa.HANDLING })]),
    );
  });

  it('remove energia da tomada excluída e mantém extras', async () => {
    const createMany = jest.fn();
    const db = dbBase(createMany);
    db.unidadeProcessoServico.findMany.mockResolvedValue([
      {
        nome: 'Lavagem',
        codigo: 'LAVAGEM',
        quantidade: 1,
        valorUnitario: 120,
        valorTotal: 120,
      },
      {
        nome: 'Tomada',
        codigo: 'TOMADA',
        quantidade: 3,
        valorUnitario: 45,
        valorTotal: 135,
        payload: { automatico: true, origem: 'TABELA_PRECO', cobranca: 'ENERGIA_REEFER', excluido: true },
      },
    ]);

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
        eventoGatilho: EventoGatilhoTarifa.ENERGIA_REEFER,
      },
    });
    expect(createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          eventoGatilho: EventoGatilhoTarifa.SERVICO_ADICIONAL,
          descricao: 'Lavagem (LAVAGEM)',
        }),
      ],
    });
  });
});