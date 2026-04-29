import type { BeneficioRhEntity, ColaboradorRhEntity, PresencaRhEntity } from './folha-rh.domain';
import {
  calcularInssProgressivo,
  calcularLinhaColaborador,
  custoPorTurno,
  FGTS_ALIQUOTA,
  salarioProporcional,
  valorHorasExtras,
  valorDsrSobreExtras,
} from './folha-rh.calculations';

describe('folha-rh.calculations', () => {
  const colab = (over: Partial<ColaboradorRhEntity> = {}): ColaboradorRhEntity => ({
    id: 'c1',
    nome: 'Teste',
    cpf: '123',
    cargo: 'Op',
    turno: 'MANHA',
    salarioBase: 4400,
    tipoContratacao: 'CLT',
    dataAdmissao: '2020-01-01',
    beneficiosAtivos: [],
    createdAt: '2020-01-01',
    ...over,
  });

  it('valorHorasExtras divide 50% nas primeiras 2h e 100% no restante', () => {
    const r = valorHorasExtras(5, 4400);
    expect(r.horas50).toBe(2);
    expect(r.horas100).toBe(3);
    expect(r.valorTotal).toBeCloseTo(r.valorHorasExtras50 + r.valorHorasExtras100, 2);
  });

  it('calcularInssProgressivo aplica faixas cumulativas', () => {
    const v = calcularInssProgressivo(2000);
    const esp =
      1518 * 0.075 + (2000 - 1518) * 0.09;
    expect(v).toBeCloseTo(esp, 2);
  });

  it('salarioProporcional sem presenças mantém salário integral', () => {
    const s = salarioProporcional(3000, '2026-04', [], 1);
    expect(s).toBe(3000);
  });

  it('valorDsrSobreExtras é proporcional a domingos/úteis', () => {
    const he = 500;
    const dsr = valorDsrSobreExtras(he, '2026-04', 2);
    expect(dsr).toBeGreaterThan(0);
  });

  it('calcularLinhaColaborador inclui FGTS patronal 8%', () => {
    const c = colab({ salarioBase: 4000 });
    const pres: PresencaRhEntity[] = [];
    const cat: BeneficioRhEntity[] = [];
    const linha = calcularLinhaColaborador(c, '2026-06', pres, cat, {
      feriadosMes: 0,
      encargosPatronaisPct: 0.2,
    });
    expect(linha.fgtsPatronal).toBeCloseTo(linha.baseBruta * FGTS_ALIQUOTA, 2);
  });

  it('custoPorTurno agrega por MANHA/TARDE/NOITE', () => {
    const linhas = [
      calcularLinhaColaborador(
        colab({ id: 'a', turno: 'MANHA' }),
        '2026-06',
        [],
        [],
        { feriadosMes: 0, encargosPatronaisPct: 0 },
      ),
      calcularLinhaColaborador(
        colab({ id: 'b', turno: 'NOITE', salarioBase: 2200 }),
        '2026-06',
        [],
        [],
        { feriadosMes: 0, encargosPatronaisPct: 0 },
      ),
    ];
    const m = custoPorTurno(linhas);
    expect(m.MANHA.headcount).toBe(1);
    expect(m.NOITE.headcount).toBe(1);
    expect(m.TARDE.headcount).toBe(0);
  });
});
