import { extractAuditMudancas } from './audit-diff.util';
import { formatarAtorAuditoria, resolveAuditAtor } from './audit-ator.util';

describe('audit-diff.util', () => {
  it('usa deltas quando existirem', () => {
    const mudancas = extractAuditMudancas(
      { status: 'PENDENTE' },
      { status: 'CANCELADO_CLIENTE', deltas: [{ campo: 'status', label: 'Status', antes: 'PENDENTE', depois: 'CANCELADO_CLIENTE' }] },
    );
    expect(mudancas).toEqual([
      { campo: 'status', label: 'Status', antes: 'PENDENTE', depois: 'CANCELADO_CLIENTE' },
    ]);
  });

  it('compara objetos aninhados quando não há deltas', () => {
    const mudancas = extractAuditMudancas(
      { transporte: { placaCavalo: 'ABC1D23' } },
      { transporte: { placaCavalo: 'XYZ9A88' } },
    );
    expect(mudancas.some((m) => m.depois === 'XYZ9A88' && m.antes === 'ABC1D23')).toBe(true);
  });

  it('lê o body do envelope HTTP do portal', () => {
    const mudancas = extractAuditMudancas(null, {
      body: { placaCavalo: 'ABC1D23', status: 'PENDENTE' },
      query: {},
      params: {},
    });
    expect(mudancas.some((m) => m.campo === 'placaCavalo' && m.depois === 'ABC1D23')).toBe(true);
  });
});

describe('audit-ator.util', () => {
  it('identifica cliente com empresa e operador', () => {
    const ator = resolveAuditAtor({
      usuarioNome: 'Ana Silva',
      usuarioRole: 'ADMIN_CLIENTE',
      dadosNovos: { ator: { tipo: 'cliente', empresaNome: 'Acme Logística', operadorNome: 'Ana Silva' } },
    });
    expect(ator.tipo).toBe('cliente');
    expect(formatarAtorAuditoria(ator)).toBe('Acme Logística · Ana Silva');
  });

  it('identifica gestor da intranet', () => {
    const ator = resolveAuditAtor({
      usuarioNome: 'João',
      usuarioRole: 'GERENTE',
    });
    expect(ator.tipo).toBe('staff');
    expect(formatarAtorAuditoria(ator)).toBe('João');
  });
});
