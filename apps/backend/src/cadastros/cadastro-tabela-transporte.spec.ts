import { resolveCadastroTabelaTransportePadraoId } from './cadastro-tabela-transporte';

describe('cadastro-tabela-transporte', () => {
  it('usa a tabela marcada como padrão', async () => {
    const db = {
      cadastroTabelaTransporte: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'a', nome: 'Especial', padrao: false },
          { id: 'p', nome: 'Tabela de transportes padrão', padrao: true },
        ]),
      },
    };
    await expect(resolveCadastroTabelaTransportePadraoId(db as never)).resolves.toBe('p');
  });

  it('cai na primeira vigente se nenhuma for padrão', async () => {
    const db = {
      cadastroTabelaTransporte: {
        findMany: jest.fn().mockResolvedValue([{ id: 'a', nome: 'Especial', padrao: false }]),
      },
    };
    await expect(resolveCadastroTabelaTransportePadraoId(db as never)).resolves.toBe('a');
  });
});
