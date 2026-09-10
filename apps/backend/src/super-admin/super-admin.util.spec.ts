import {
  applyEmpresaIdentidade,
  cnpjFromParametros,
  motivoBloqueioExclusao,
  podeAlterarStatusBase,
} from './super-admin.util';

const vazio = { users: 0, clientes: 0, solicitacoes: 0, faturas: 0, unidadeProcessos: 0 };

describe('super-admin.util', () => {
  it('não exclui o terminal base', () => {
    expect(motivoBloqueioExclusao('default', vazio)).toMatch(/base/);
  });

  it('exclui terminal vazio que não é o default', () => {
    expect(motivoBloqueioExclusao('terminal-xpto', vazio)).toBeNull();
  });

  it('bloqueia exclusão quando há usuários ou faturas', () => {
    expect(motivoBloqueioExclusao('terminal-xpto', { ...vazio, users: 2 })).toMatch(/usuário/);
    expect(motivoBloqueioExclusao('terminal-xpto', { ...vazio, faturas: 1 })).toMatch(/fatura/);
  });

  it('não deixa bloquear o terminal base', () => {
    expect(podeAlterarStatusBase('default', 'BLOQUEADO')).toBe(false);
    expect(podeAlterarStatusBase('default', 'ATIVO')).toBe(true);
    expect(podeAlterarStatusBase('outro', 'BLOQUEADO')).toBe(true);
  });

  it('grava CNPJ na ficha da empresa sem apagar o restante', () => {
    const out = applyEmpresaIdentidade(
      { empresa: { razaoSocial: 'RL', cnpj: '111', aliquotaIss: 6 } },
      { cnpj: '04.252.617/0001-08', empresa: { cidade: 'Itajaí' } },
    );
    const emp = out.empresa as { cnpj: string; razaoSocial: string; cidade: string; aliquotaIss: number };
    expect(emp.cnpj).toBe('04252617000108');
    expect(emp.razaoSocial).toBe('RL');
    expect(emp.cidade).toBe('Itajaí');
    expect(emp.aliquotaIss).toBe(6);
  });

  it('lê CNPJ dos parametros', () => {
    expect(cnpjFromParametros({ empresa: { cnpj: '04.252.617/0001-08' } })).toBe('04252617000108');
    expect(cnpjFromParametros({})).toBe('');
  });
});
