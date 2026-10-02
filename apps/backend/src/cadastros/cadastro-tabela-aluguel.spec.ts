import { resolveCadastroTabelaAluguelPadraoId } from './cadastro-tabela-aluguel';

describe('cadastro-tabela-aluguel', () => {
  it('usa a tabela marcada como padrão', async () => {
    const db = {
      cadastroTabelaAluguel: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'p', padrao: true },
          { id: 'a', padrao: false },
        ]),
      },
    };
    await expect(resolveCadastroTabelaAluguelPadraoId(db as never)).resolves.toBe('p');
  });

  it('cai na primeira vigente se nenhuma for padrão', async () => {
    const db = {
      cadastroTabelaAluguel: {
        findMany: jest.fn().mockResolvedValue([{ id: 'a', padrao: false }]),
      },
    };
    await expect(resolveCadastroTabelaAluguelPadraoId(db as never)).resolves.toBe('a');
  });
});
