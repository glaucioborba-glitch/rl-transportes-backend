import {
  consistenciaTemporalViolacoes,
  contarFkClienteOrfasNosFatos,
  extrairSkClientesDim,
  taxaCompletudeCampos,
  taxaDuplicidadePorChave,
} from './datahub-quality.metrics';

describe('datahub-quality.metrics', () => {
  it('taxaCompletudeCampos', () => {
    const rows = [{ a: '1', b: '' }, { a: null, b: 'x' }] as unknown as Record<string, unknown>[];
    const t = taxaCompletudeCampos(rows, ['a', 'b']);
    expect(t).toBeGreaterThan(0);
    expect(t).toBeLessThanOrEqual(1);
  });

  it('taxaDuplicidadePorChave', () => {
    const dup = taxaDuplicidadePorChave(
      [{ id: 'a' }, { id: 'a' }, { id: 'b' }],
      (r) => r.id,
    );
    expect(dup).toBeGreaterThan(0);
  });

  it('consistenciaTemporalViolacoes', () => {
    const d1 = new Date('2026-01-02');
    const d0 = new Date('2026-01-01');
    expect(consistenciaTemporalViolacoes([{ ini: d0, fim: d1 }])).toBe(0);
    expect(consistenciaTemporalViolacoes([{ ini: d1, fim: d0 }])).toBe(1);
  });

  it('contarFkClienteOrfasNosFatos', () => {
    const sk = new Set(['c_000000001']);
    const fatos = {
      FATO_X: [
        { fk_cliente: 'c_000000001' },
        { fk_cliente: 'c_999999999' },
      ],
    };
    expect(contarFkClienteOrfasNosFatos(fatos, sk)).toBe(1);
  });

  it('extrairSkClientesDim', () => {
    const s = extrairSkClientesDim([
      { sk_cliente: 'c_1', nome: 'a' },
      { sk_cliente: 'c_1', nome: 'b' },
    ]);
    expect(s.has('c_1')).toBe(true);
    expect(s.size).toBe(1);
  });
});
