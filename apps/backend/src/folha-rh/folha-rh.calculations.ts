/**
 * Motor de cálculo RH — premissas documentadas no Swagger do controller.
 * Valores de INSS em faixas são proxy editável via FOLHA_INSS_* (sem persistência fiscal nesta fase).
 */

import type {
  BeneficioRhEntity,
  ColaboradorRhEntity,
  PresencaRhEntity,
  TurnoRh,
} from './folha-rh.domain';

export const HORAS_MENSAIS_CLT_PADRAO = 220;

/** FGTS patronal sobre base de cálculo remuneratória (Lei nº 8.036/90 — taxa nominal 8%). */
export const FGTS_ALIQUOTA = 0.08;

export interface InssFaixaConfig {
  limiteAte: number;
  aliquota: number;
}

/** Padrão compatível com faixas progressivas INSS (valores aproximados — ajuste por env). */
export const INSS_FAIXAS_PADRAO: InssFaixaConfig[] = [
  { limiteAte: 1518.0, aliquota: 0.075 },
  { limiteAte: 2793.88, aliquota: 0.09 },
  { limiteAte: 4190.83, aliquota: 0.12 },
  { limiteAte: 8157.41, aliquota: 0.14 },
];

export function calcularInssProgressivo(
  baseContribuicao: number,
  faixas: InssFaixaConfig[] = INSS_FAIXAS_PADRAO,
  teto?: number,
): number {
  const tetoInss = teto ?? faixas[faixas.length - 1]?.limiteAte ?? baseContribuicao;
  const x = Math.max(0, Math.min(baseContribuicao, tetoInss));
  let inferior = 0;
  let total = 0;
  for (const f of faixas) {
    if (x <= inferior) break;
    const chunk = Math.min(x, f.limiteAte) - inferior;
    if (chunk > 0) total += chunk * f.aliquota;
    inferior = f.limiteAte;
  }
  return Math.round(total * 100) / 100;
}

export function valorHora(salarioBase: number, horasMes = HORAS_MENSAIS_CLT_PADRAO): number {
  return salarioBase / horasMes;
}

/**
 * HE: primeiras 2h × 1,5 × VH; excedente × 2 × VH (modelo simplificado CLT para dias úteis).
 */
export function valorHorasExtras(horasExtras: number, salarioBase: number): {
  horas50: number;
  horas100: number;
  valorHorasExtras50: number;
  valorHorasExtras100: number;
  valorTotal: number;
} {
  const vh = valorHora(salarioBase);
  const horas50 = Math.min(Math.max(horasExtras, 0), 2);
  const horas100 = Math.max(0, horasExtras - 2);
  const valorHorasExtras50 = Math.round(horas50 * vh * 1.5 * 100) / 100;
  const valorHorasExtras100 = Math.round(horas100 * vh * 2 * 100) / 100;
  return {
    horas50,
    horas100,
    valorHorasExtras50,
    valorHorasExtras100,
    valorTotal: valorHorasExtras50 + valorHorasExtras100,
  };
}

/** Adicional noturno 20% sobre hora normal (Art. 73 CLT — simplificado sem hora reduzida). */
export function valorAdicionalNoturno(horasNoturnas: number, salarioBase: number): number {
  const vh = valorHora(salarioBase);
  return Math.round(horasNoturnas * vh * 0.2 * 100) / 100;
}

export function mesPrimeiroUltimoDia(mesIso: string): { primeiroIso: string; ultimoIso: string; diasNoMes: number } {
  const [y, m] = mesIso.split('-').map(Number);
  const diasNoMes = new Date(y, m, 0).getDate();
  const primeiroIso = `${y}-${String(m).padStart(2, '0')}-01`;
  const ultimoIso = `${y}-${String(m).padStart(2, '0')}-${String(diasNoMes).padStart(2, '0')}`;
  return { primeiroIso, ultimoIso, diasNoMes };
}

export function contarDomingosNoMes(mesIso: string): number {
  const [y, m] = mesIso.split('-').map(Number);
  const diasNoMes = new Date(y, m, 0).getDate();
  let n = 0;
  for (let d = 1; d <= diasNoMes; d++) {
    const dt = new Date(y, m - 1, d);
    if (dt.getDay() === 0) n += 1;
  }
  return n;
}

export function diasUteisAproximados(mesIso: string, feriadosExtras = 0): number {
  const { diasNoMes } = mesPrimeiroUltimoDia(mesIso);
  const dom = contarDomingosNoMes(mesIso);
  return Math.max(1, diasNoMes - dom - feriadosExtras);
}

/**
 * DSR sobre HE: (valor HE / dias úteis) × (domingos + feriados proxy).
 */
export function valorDsrSobreExtras(
  valorHorasExtrasTotal: number,
  mesIso: string,
  feriadosNacionaisMes = 0,
): number {
  const dom = contarDomingosNoMes(mesIso);
  const du = diasUteisAproximados(mesIso, feriadosNacionaisMes);
  const descanso = dom + feriadosNacionaisMes;
  if (du <= 0 || valorHorasExtrasTotal <= 0) return 0;
  return Math.round((valorHorasExtrasTotal / du) * descanso * 100) / 100;
}

export function colaboradorAtivoNoMes(c: ColaboradorRhEntity, mesIso: string): boolean {
  const { primeiroIso, ultimoIso } = mesPrimeiroUltimoDia(mesIso);
  const adm = c.dataAdmissao.slice(0, 10);
  if (adm > ultimoIso) return false;
  if (c.dataDemissao && c.dataDemissao.slice(0, 10) < primeiroIso) return false;
  return true;
}

export interface BeneficioAplicadoColaborador {
  nomeBeneficio: string;
  valorEmpresa: number;
  valorDescontoFolha: number;
}

export function aplicarBeneficiosCatalogo(
  colab: ColaboradorRhEntity,
  catalogo: BeneficioRhEntity[],
): BeneficioAplicadoColaborador[] {
  const norm = (s: string) => s.trim().toLowerCase();
  const ativos = new Set(colab.beneficiosAtivos.map(norm));
  const out: BeneficioAplicadoColaborador[] = [];
  for (const b of catalogo) {
    if (!ativos.has(norm(b.nomeBeneficio))) continue;
    let valorEmpresa = 0;
    let valorDescontoFolha = 0;
    if (b.tipoBeneficio === 'fixo') {
      valorEmpresa = b.valorMensal;
      valorDescontoFolha = 0;
    } else if (b.tipoBeneficio === 'percentual') {
      const pct = b.valorMensal / 100;
      valorEmpresa = Math.round(colab.salarioBase * pct * 100) / 100;
      valorDescontoFolha = 0;
    } else {
      valorEmpresa = b.valorMensal;
      valorDescontoFolha = Math.round(b.valorMensal * 0.2 * 100) / 100;
    }
    out.push({
      nomeBeneficio: b.nomeBeneficio,
      valorEmpresa,
      valorDescontoFolha,
    });
  }
  return out;
}

export function agregarPresencasMes(registros: PresencaRhEntity[]): {
  horasTrabalhadas: number;
  horasExtras: number;
  adicionalNoturnoHoras: number;
  diasComFalta: number;
  diasSemFalta: number;
} {
  let horasTrabalhadas = 0;
  let horasExtras = 0;
  let adicionalNoturnoHoras = 0;
  let diasComFalta = 0;
  let diasSemFalta = 0;
  for (const p of registros) {
    horasTrabalhadas += p.horasTrabalhadas;
    horasExtras += p.horasExtras;
    adicionalNoturnoHoras += p.adicionalNoturnoHoras;
    if (p.falta) diasComFalta += 1;
    else diasSemFalta += 1;
  }
  return {
    horasTrabalhadas,
    horasExtras,
    adicionalNoturnoHoras,
    diasComFalta,
    diasSemFalta,
  };
}

export function salarioProporcional(
  salarioBase: number,
  mesIso: string,
  presencas: PresencaRhEntity[],
  feriados = 0,
): number {
  const du = diasUteisAproximados(mesIso, feriados);
  const { diasSemFalta } = agregarPresencasMes(presencas);
  if (presencas.length === 0) {
    return Math.round(salarioBase * 100) / 100;
  }
  const fator = Math.min(1, diasSemFalta / du);
  return Math.round(salarioBase * fator * 100) / 100;
}

export interface LinhaColaboradorCalculo {
  colaboradorId: string;
  nome: string;
  turno: TurnoRh;
  salarioBase: number;
  salarioProporcional: number;
  valorHorasExtras50: number;
  valorHorasExtras100: number;
  valorHorasExtrasTotal: number;
  valorAdicionalNoturno: number;
  valorDsr: number;
  beneficiosEmpresa: number;
  descontoBeneficiosFolha: number;
  baseBruta: number;
  inssFuncionario: number;
  fgtsPatronal: number;
  encargosPatronaisValor: number;
  provisaoFerias: number;
  provisaoDecimoTerceiro: number;
  salarioLiquido: number;
  custoTotalEmpresa: number;
}

export function calcularLinhaColaborador(
  c: ColaboradorRhEntity,
  mesIso: string,
  presencas: PresencaRhEntity[],
  catalogoBeneficios: BeneficioRhEntity[],
  opts: {
    feriadosMes?: number;
    encargosPatronaisPct?: number;
    inssTeto?: number;
    faixasInss?: InssFaixaConfig[];
  } = {},
): LinhaColaboradorCalculo {
  const feriados = opts.feriadosMes ?? 0;
  const encPat = opts.encargosPatronaisPct ?? 0.28;

  const agg = agregarPresencasMes(presencas);
  const salProp = salarioProporcional(c.salarioBase, mesIso, presencas, feriados);

  const he = valorHorasExtras(agg.horasExtras, c.salarioBase);
  const noturno = valorAdicionalNoturno(agg.adicionalNoturnoHoras, c.salarioBase);
  const dsr = valorDsrSobreExtras(he.valorTotal, mesIso, feriados);

  const ben = aplicarBeneficiosCatalogo(c, catalogoBeneficios);
  const beneficiosEmpresa = ben.reduce((s, x) => s + x.valorEmpresa, 0);
  const descontoBeneficiosFolha = ben.reduce((s, x) => s + x.valorDescontoFolha, 0);

  const baseBruta =
    Math.round((salProp + he.valorTotal + noturno + dsr) * 100) / 100;

  const inssFuncionario = calcularInssProgressivo(
    baseBruta,
    opts.faixasInss,
    opts.inssTeto,
  );

  const baseFgtsEncargos = baseBruta;

  const fgtsPatronal = Math.round(baseFgtsEncargos * FGTS_ALIQUOTA * 100) / 100;
  const encargosPatronaisValor = Math.round(baseFgtsEncargos * encPat * 100) / 100;

  const provisaoFerias = Math.round((c.salarioBase / 12) * 100) / 100;
  const provisaoDecimoTerceiro = Math.round((c.salarioBase / 12) * 100) / 100;

  const salarioLiquido =
    Math.round((baseBruta - inssFuncionario - descontoBeneficiosFolha) * 100) / 100;

  const custoTotalEmpresa =
    Math.round(
      (baseBruta +
        fgtsPatronal +
        encargosPatronaisValor +
        beneficiosEmpresa +
        provisaoFerias +
        provisaoDecimoTerceiro) *
        100,
    ) / 100;

  return {
    colaboradorId: c.id,
    nome: c.nome,
    turno: c.turno,
    salarioBase: c.salarioBase,
    salarioProporcional: salProp,
    valorHorasExtras50: he.valorHorasExtras50,
    valorHorasExtras100: he.valorHorasExtras100,
    valorHorasExtrasTotal: he.valorTotal,
    valorAdicionalNoturno: noturno,
    valorDsr: dsr,
    beneficiosEmpresa,
    descontoBeneficiosFolha,
    baseBruta,
    inssFuncionario,
    fgtsPatronal,
    encargosPatronaisValor,
    provisaoFerias,
    provisaoDecimoTerceiro,
    salarioLiquido,
    custoTotalEmpresa,
  };
}

export function custoPorTurno(
  linhas: LinhaColaboradorCalculo[],
): Record<TurnoRh, { custoTotal: number; headcount: number; custoMedio: number }> {
  const map: Record<string, { custoTotal: number; headcount: number }> = {
    MANHA: { custoTotal: 0, headcount: 0 },
    TARDE: { custoTotal: 0, headcount: 0 },
    NOITE: { custoTotal: 0, headcount: 0 },
  };
  for (const l of linhas) {
    map[l.turno].custoTotal += l.custoTotalEmpresa;
    map[l.turno].headcount += 1;
  }
  const out = {} as Record<TurnoRh, { custoTotal: number; headcount: number; custoMedio: number }>;
  for (const t of ['MANHA', 'TARDE', 'NOITE'] as TurnoRh[]) {
    const x = map[t];
    out[t] = {
      custoTotal: Math.round(x.custoTotal * 100) / 100,
      headcount: x.headcount,
      custoMedio: x.headcount > 0 ? Math.round((x.custoTotal / x.headcount) * 100) / 100 : 0,
    };
  }
  return out;
}
