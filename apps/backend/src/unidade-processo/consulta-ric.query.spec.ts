import { janelaConsultaRic, prismaWhereConsultaRic } from './consulta-ric.query';

describe('consulta-ric.query', () => {
  it('usa janela de 10 dias quando de/até omitidos', () => {
    const { inicio, fim } = janelaConsultaRic();
    const ms = fim.getTime() - inicio.getTime();
    expect(ms).toBeGreaterThanOrEqual(9 * 24 * 60 * 60 * 1000);
    expect(ms).toBeLessThan(11 * 24 * 60 * 60 * 1000);
  });

  it('filtra saída só por saidaEm no período', () => {
    const where = prismaWhereConsultaRic('default', {
      direcao: 'SAIDA',
      de: '2026-08-20',
      ate: '2026-08-31',
    });
    expect(where.tenantId).toBe('default');
    expect(where.AND).toEqual(
      expect.arrayContaining([expect.objectContaining({ saidaEm: expect.any(Object) })]),
    );
    expect(JSON.stringify(where)).not.toContain('"entradaEm"');
  });

  it('busca número de ID quando a query é só dígitos', () => {
    const where = prismaWhereConsultaRic('default', { q: '1284' });
    expect(JSON.stringify(where)).toContain('"numero":1284');
  });
});
