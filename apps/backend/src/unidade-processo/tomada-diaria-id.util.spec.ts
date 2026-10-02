import { upsertTomadaDiariaNoProcesso } from './tomada-diaria-id.util';

describe('upsertTomadaDiariaNoProcesso', () => {
  it('não apaga nem recalcula tomada já excluída com senha gerencial', async () => {
    const db = {
      unidadeProcessoServico: {
        findFirst: jest.fn().mockResolvedValue({
          id: 't1',
          payload: { automatico: true, origem: 'TABELA_PRECO', excluido: true },
        }),
        delete: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
    };

    await upsertTomadaDiariaNoProcesso(db as never, {
      unidadeProcessoId: 'up1',
      clienteId: 'c1',
      eventos: [],
      conectada: false,
    });

    expect(db.unidadeProcessoServico.delete).not.toHaveBeenCalled();
    expect(db.unidadeProcessoServico.update).not.toHaveBeenCalled();
    expect(db.unidadeProcessoServico.create).not.toHaveBeenCalled();
  });
});
