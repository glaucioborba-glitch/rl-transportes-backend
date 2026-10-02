import { cadastroIdAtribuido, cadastroIdFromBilling, labelTabelaPrecoCadastro, ordenarTabelasCandidatas } from './cadastro-tabela-preco-vigente';

describe('cadastro-tabela-preco-vigente', () => {
  const padrao = { id: 'p', nome: 'TABELA PADRÃO', padrao: true, billingTabelaPrecoId: 'b-padrao', clienteId: null };
  const especial = { id: 'e', nome: 'Especial', padrao: false, billingTabelaPrecoId: 'b-esp', clienteId: null };
  const legado = { id: 'l', nome: 'Legado', padrao: false, billingTabelaPrecoId: 'b-leg', clienteId: 'cli-1' };

  it('prioriza a tabela atribuída no cliente', () => {
    const ordered = ordenarTabelasCandidatas([padrao, especial, legado], {
      billingTabelaPrecoId: 'b-esp',
      clienteId: 'cli-1',
    });
    expect(ordered.map((t) => t.id)).toEqual(['e', 'l', 'p']);
  });

  it('usa vínculo legado na tabela se o cliente ainda não tem billing id', () => {
    const ordered = ordenarTabelasCandidatas([padrao, legado], { clienteId: 'cli-1' });
    expect(ordered[0].id).toBe('l');
  });

  it('mapeia billing id para o cadastro, com fallback no padrão', () => {
    const list = [padrao, especial].map((t) => ({
      id: t.id,
      nome: t.nome,
      padrao: t.padrao,
      billingTabelaPrecoId: t.billingTabelaPrecoId,
    }));
    expect(cadastroIdFromBilling(list, 'b-esp')).toBe('e');
    expect(cadastroIdFromBilling(list, null)).toBe('p');
    expect(cadastroIdFromBilling(list, 'desconhecido')).toBe('p');
  });

  it('mapeia só a tabela realmente atribuída, sem cair na padrão', () => {
    const list = [padrao, especial].map((t) => ({
      id: t.id,
      billingTabelaPrecoId: t.billingTabelaPrecoId,
    }));
    expect(cadastroIdAtribuido(list, 'b-esp')).toBe('e');
    expect(cadastroIdAtribuido(list, null)).toBeNull();
    expect(cadastroIdAtribuido(list, 'desconhecido')).toBeNull();
  });

  it('rotula a tabela padrão', () => {
    expect(labelTabelaPrecoCadastro(padrao)).toBe('TABELA PADRÃO (padrão)');
    expect(labelTabelaPrecoCadastro(especial)).toBe('Especial');
  });
});
