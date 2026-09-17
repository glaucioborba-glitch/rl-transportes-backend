import { resolveCadastroTabelaServicoPadraoId } from './cadastro-tabela-servico';

describe('cadastro-tabela-servico', () => {
  it('usa a tabela marcada como padrão', async () => {
    const db = {
      cadastroTabelaServico: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'p', padrao: true },
          { id: 'a', padrao: false },
        ]),
      },
    };
    await expect(resolveCadastroTabelaServicoPadraoId(db as never)).resolves.toBe('p');
  });

  it('cai na primeira vigente se nenhuma for padrão', async () => {
    const db = {
      cadastroTabelaServico: {
        findMany: jest.fn().mockResolvedValue([{ id: 'a', padrao: false }]),
      },
    };
    await expect(resolveCadastroTabelaServicoPadraoId(db as never)).resolves.toBe('a');
  });
});
