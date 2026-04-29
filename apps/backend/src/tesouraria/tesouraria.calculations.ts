import type {
  CategoriaDespesa,
  ContratoEntity,
  DespesaEntity,
  MesValorFin,
  StatusDespesaPersistido,
} from './tesouraria.domain';

export type StatusDespesaExibicao = 'pendente' | 'pago' | 'atrasado';

export interface PagamentoProjetado {
  data: string;
  valor: number;
  origem: 'despesa' | 'contrato' | 'imposto';
  referenciaId: string;
  rotulo: string;
}

/** Normaliza status persistido + data de vencimento → exibição (pendente vencida → atrasado). */
export function resolverStatusDespesa(
  status: StatusDespesaPersistido,
  vencimentoIso: string,
  hoje = new Date(),
): StatusDespesaExibicao {
  if (status === 'pago') return 'pago';
  const v = parseIsoDateOnly(vencimentoIso);
  const h = startOfDay(hoje);
  if (v < h) return 'atrasado';
  return 'pendente';
}

function parseIsoDateOnly(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatDateOnly(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addMonths(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  x.setMonth(x.getMonth() + n);
  return x;
}

function addYears(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  x.setFullYear(x.getFullYear() + n);
  return x;
}

/** Anos completos entre duas datas (aniversário de contrato). */
export function anosEntre(inicio: Date, ref: Date): number {
  let y = ref.getFullYear() - inicio.getFullYear();
  const m = ref.getMonth() - inicio.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < inicio.getDate())) y -= 1;
  return Math.max(0, y);
}

export function valorContratoComReajuste(
  valorFixo: number,
  reajusteAnualPct: number,
  vigenciaInicioIso: string,
  dataRefIso: string,
): number {
  const ini = parseIsoDateOnly(vigenciaInicioIso);
  const ref = parseIsoDateOnly(dataRefIso);
  const anos = anosEntre(ini, ref);
  const f = Math.pow(1 + reajusteAnualPct / 100, anos);
  return Math.round(valorFixo * f * 100) / 100;
}

/** Despesas pontuais e linhas recorrentes projetadas dentro do intervalo [inicio, fim]. */
export function expandirDespesasParaPagamentos(
  despesas: DespesaEntity[],
  inicio: Date,
  fim: Date,
): PagamentoProjetado[] {
  const out: PagamentoProjetado[] = [];
  const ini = startOfDay(inicio);
  const fi = startOfDay(fim);

  for (const d of despesas) {
    if (d.status === 'pago') continue;

    const base = parseIsoDateOnly(d.vencimento);

    if (d.recorrencia === 'nenhuma') {
      if (base >= ini && base <= fi) {
        out.push({
          data: formatDateOnly(base),
          valor: d.valor,
          origem: d.categoria === 'IMPOSTOS' ? 'imposto' : 'despesa',
          referenciaId: d.id,
          rotulo: `${d.descricao} (${d.fornecedor})`,
        });
      }
      continue;
    }

    if (d.recorrencia === 'mensal') {
      let cursor = new Date(base.getFullYear(), base.getMonth(), base.getDate());
      while (cursor < ini) cursor = addMonths(cursor, 1);
      while (cursor <= fi) {
        out.push({
          data: formatDateOnly(cursor),
          valor: d.valor,
          origem: d.categoria === 'IMPOSTOS' ? 'imposto' : 'despesa',
          referenciaId: d.id,
          rotulo: `${d.descricao} (${d.fornecedor}) — mensal`,
        });
        cursor = addMonths(cursor, 1);
      }
      continue;
    }

    if (d.recorrencia === 'anual') {
      let cursor = new Date(base.getFullYear(), base.getMonth(), base.getDate());
      while (cursor < ini) cursor = addYears(cursor, 1);
      while (cursor <= fi) {
        out.push({
          data: formatDateOnly(cursor),
          valor: d.valor,
          origem: d.categoria === 'IMPOSTOS' ? 'imposto' : 'despesa',
          referenciaId: d.id,
          rotulo: `${d.descricao} (${d.fornecedor}) — anual`,
        });
        cursor = addYears(cursor, 1);
      }
    }
  }

  return out;
}

function tipoContratoEhMensal(t: ContratoEntity['tipoContrato']): boolean {
  return t === 'mensal' || t === 'SLA' || t === 'servico';
}

/** Parcelas de contrato no intervalo [inicio, fim]. */
export function expandirContratosParaPagamentos(
  contratos: ContratoEntity[],
  fornecedorNome: (id: string) => string | undefined,
  inicio: Date,
  fim: Date,
): PagamentoProjetado[] {
  const out: PagamentoProjetado[] = [];
  const ini = startOfDay(inicio);
  const fi = startOfDay(fim);

  for (const c of contratos) {
    const vIni = parseIsoDateOnly(c.vigenciaInicio);
    const vFim = parseIsoDateOnly(c.vigenciaFim);
    if (vFim < ini || vIni > fi) continue;

    const nomeFor = fornecedorNome(c.fornecedorId) ?? c.fornecedorId;

    if (c.tipoContrato === 'anual') {
      let cursor = new Date(vIni.getFullYear(), vIni.getMonth(), vIni.getDate());
      while (cursor < ini) cursor = addYears(cursor, 1);
      while (cursor <= fi && cursor <= vFim) {
        if (cursor >= vIni) {
          const v = valorContratoComReajuste(c.valorFixo, c.reajusteAnualPct, c.vigenciaInicio, formatDateOnly(cursor));
          out.push({
            data: formatDateOnly(cursor),
            valor: v,
            origem: 'contrato',
            referenciaId: c.id,
            rotulo: `Contrato ${nomeFor} — anual`,
          });
        }
        cursor = addYears(cursor, 1);
      }
      continue;
    }

    if (tipoContratoEhMensal(c.tipoContrato)) {
      let cursor = new Date(vIni.getFullYear(), vIni.getMonth(), vIni.getDate());
      while (cursor < ini) cursor = addMonths(cursor, 1);
      while (cursor <= fi && cursor <= vFim && cursor >= vIni) {
        const v = valorContratoComReajuste(c.valorFixo, c.reajusteAnualPct, c.vigenciaInicio, formatDateOnly(cursor));
        out.push({
          data: formatDateOnly(cursor),
          valor: v,
          origem: 'contrato',
          referenciaId: c.id,
          rotulo: `Contrato ${nomeFor} — mensal`,
        });
        cursor = addMonths(cursor, 1);
      }
    }
  }

  return out;
}

export function somarPagamentosPorDia(pags: PagamentoProjetado[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const p of pags) {
    m[p.data] = (m[p.data] ?? 0) + p.valor;
  }
  return m;
}

/** ISO semana (segunda como início, simplificado). */
export function semanaChaveBr(dataIso: string): string {
  const d = parseIsoDateOnly(dataIso);
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  const seg = new Date(d.getTime());
  seg.setDate(seg.getDate() + diff);
  return formatDateOnly(seg);
}

export function somarPorSemana(porDia: Record<string, number>): Record<string, number> {
  const m: Record<string, number> = {};
  for (const [dia, v] of Object.entries(porDia)) {
    const sk = semanaChaveBr(dia);
    m[sk] = (m[sk] ?? 0) + v;
  }
  return m;
}

export function mesChave(dataIso: string): string {
  return dataIso.slice(0, 7);
}

export function somarPorMes(porDia: Record<string, number>): Record<string, number> {
  const m: Record<string, number> = {};
  for (const [dia, v] of Object.entries(porDia)) {
    const mk = mesChave(dia);
    m[mk] = (m[mk] ?? 0) + v;
  }
  return m;
}

export function totalSaidaNoPeriodo(pags: PagamentoProjetado[]): number {
  return Math.round(pags.reduce((s, p) => s + p.valor, 0) * 100) / 100;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + n);
  return x;
}

/** Saídas de tesouraria “OPEX” (exclui despesas categoria CAPEX); contratos entram integralmente. */
export function somaSaidaOpexNoPeriodo(
  despesas: DespesaEntity[],
  contratos: ContratoEntity[],
  fornecedorNome: (id: string) => string | undefined,
  inicio: Date,
  fim: Date,
): number {
  const dex = despesas.filter((d) => d.categoria !== 'CAPEX');
  const pD = expandirDespesasParaPagamentos(dex, inicio, fim);
  const pC = expandirContratosParaPagamentos(contratos, fornecedorNome, inicio, fim);
  return totalSaidaNoPeriodo([...pD, ...pC]);
}

/** Todas as saídas projetadas no período (inclui CAPEX em despesas). */
export function somaSaidaTotalNoPeriodo(
  despesas: DespesaEntity[],
  contratos: ContratoEntity[],
  fornecedorNome: (id: string) => string | undefined,
  inicio: Date,
  fim: Date,
): number {
  const pD = expandirDespesasParaPagamentos(despesas, inicio, fim);
  const pC = expandirContratosParaPagamentos(contratos, fornecedorNome, inicio, fim);
  return totalSaidaNoPeriodo([...pD, ...pC]);
}

const OPEX_CATEGORIAS = new Set<CategoriaDespesa>([
  'OPEX',
  'MANUTENCAO',
  'SERVICOS',
  'TI',
  'FROTA',
  'IMPOSTOS',
]);

export function isOpexCategoria(cat: CategoriaDespesa): boolean {
  return OPEX_CATEGORIAS.has(cat);
}

/** Curvas mensais para os próximos 12 meses a partir de refDate (mês corrente = índice 0). */
export function projetarCurvasOpexCapex12Meses(
  despesas: DespesaEntity[],
  contratos: ContratoEntity[],
  fornecedorNome: (id: string) => string | undefined,
  refDate = new Date(),
): { curvaOpex12Meses: MesValorFin[]; curvaCapex12Meses: MesValorFin[] } {
  const base = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
  const ultimoDia = addMonths(base, 12);
  ultimoDia.setDate(ultimoDia.getDate() - 1);

  const pDesp = expandirDespesasParaPagamentos(despesas, base, ultimoDia);
  const pContr = expandirContratosParaPagamentos(contratos, fornecedorNome, base, ultimoDia);

  const porMesOpex: Record<string, number> = {};
  const porMesCapex: Record<string, number> = {};

  const despesaPorId = new Map(despesas.map((d) => [d.id, d]));

  for (const p of pDesp) {
    const d = despesaPorId.get(p.referenciaId);
    if (!d || d.status === 'pago') continue;
    const mes = mesChave(p.data);
    if (d.categoria === 'CAPEX') {
      porMesCapex[mes] = (porMesCapex[mes] ?? 0) + p.valor;
    } else {
      porMesOpex[mes] = (porMesOpex[mes] ?? 0) + p.valor;
    }
  }

  for (const p of pContr) {
    const mes = mesChave(p.data);
    porMesOpex[mes] = (porMesOpex[mes] ?? 0) + p.valor;
  }

  const curvaOpex12Meses: MesValorFin[] = [];
  const curvaCapex12Meses: MesValorFin[] = [];

  for (let i = 0; i < 12; i++) {
    const dt = addMonths(base, i);
    const mes = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    curvaOpex12Meses.push({
      mes,
      valor: Math.round((porMesOpex[mes] ?? 0) * 100) / 100,
    });
    curvaCapex12Meses.push({
      mes,
      valor: Math.round((porMesCapex[mes] ?? 0) * 100) / 100,
    });
  }

  return { curvaOpex12Meses, curvaCapex12Meses };
}

export type NivelRisco = 'baixo' | 'medio' | 'alto';

export function avaliarRiscoSaidasFinanceiras(input: {
  totalPendenteProx30d: number;
  saldoProxy: number;
  entradasPrevistas30d: number;
  despesasAtrasadasCount: number;
}): NivelRisco {
  const cobertura = input.saldoProxy + input.entradasPrevistas30d;
  const ratio = cobertura > 0 ? input.totalPendenteProx30d / cobertura : input.totalPendenteProx30d > 0 ? 2 : 0;
  if (input.despesasAtrasadasCount >= 5 || ratio > 0.85) return 'alto';
  if (input.despesasAtrasadasCount >= 2 || ratio > 0.45) return 'medio';
  return 'baixo';
}

export function scoreConfiabilidadeFinanceira(input: {
  totalDespesas: number;
  atrasadas: number;
  duplicidadesPotenciais: number;
}): number {
  let s = 100;
  if (input.totalDespesas > 0) {
    s -= Math.min(40, (input.atrasadas / input.totalDespesas) * 80);
  } else {
    s -= input.atrasadas > 0 ? 30 : 0;
  }
  s -= Math.min(25, input.duplicidadesPotenciais * 8);
  return Math.max(0, Math.min(100, Math.round(s)));
}

export interface SugestaoItem {
  tipo: string;
  severidade: 'info' | 'warning' | 'critical';
  mensagem: string;
  referencia?: string;
}

export function gerarSugestoes(input: {
  despesas: DespesaEntity[];
  contratos: ContratoEntity[];
  fornecedores: { id: string; nome: string }[];
  /** Total pendente tesouraria próx. 90d vs entrada proxy Fase 9 */
  estouroCaixaPotencial: boolean;
}): SugestaoItem[] {
  const out: SugestaoItem[] = [];
  const hoje = startOfDay(new Date());

  for (const c of input.contratos) {
    const ini = parseIsoDateOnly(c.vigenciaInicio);
    let aniv = new Date(hoje.getFullYear(), ini.getMonth(), ini.getDate());
    if (aniv < hoje) aniv = addYears(aniv, 1);
    const dias = (aniv.getTime() - hoje.getTime()) / (86400 * 1000);
    if (dias >= 0 && dias <= 45 && c.reajusteAnualPct !== 0) {
      out.push({
        tipo: 'reajuste_contrato',
        severidade: 'warning',
        mensagem: `Contrato ${c.id.slice(0, 8)}… tem aniversário/reajuste em até 45 dias.`,
        referencia: c.id,
      });
    }
  }

  const porCat: Record<string, number[]> = {};
  for (const d of input.despesas) {
    if (d.status === 'pago') continue;
    const k = d.categoria;
    porCat[k] = porCat[k] ?? [];
    porCat[k].push(d.valor);
  }

  const jaAltoImpacto = new Set<string>();
  for (const [cat, vals] of Object.entries(porCat)) {
    if (vals.length < 2) continue;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    for (const d of input.despesas) {
      if (d.categoria !== cat || d.status === 'pago') continue;
      if (jaAltoImpacto.has(d.id)) continue;
      if (d.valor > avg * 1.35 && avg > 0) {
        jaAltoImpacto.add(d.id);
        out.push({
          tipo: 'alto_impacto',
          severidade: 'info',
          mensagem: `Despesa "${d.descricao.slice(0, 40)}" está acima da média da categoria ${cat}.`,
          referencia: d.id,
        });
      }
    }
  }

  const porMesFornecedor: Record<string, DespesaEntity[]> = {};
  for (const d of input.despesas) {
    const mk = `${mesChave(d.vencimento)}|${d.fornecedor.trim().toLowerCase()}|${d.valor}`;
    porMesFornecedor[mk] = porMesFornecedor[mk] ?? [];
    porMesFornecedor[mk].push(d);
  }
  for (const [, grupo] of Object.entries(porMesFornecedor)) {
    if (grupo.length >= 2) {
      out.push({
        tipo: 'duplicidade_potencial',
        severidade: 'warning',
        mensagem: `Possível duplicidade: mesmo fornecedor/valor no mês (${grupo[0].fornecedor}).`,
        referencia: grupo.map((g) => g.id).join(','),
      });
    }
  }

  const fornecedoresComContrato = new Set(input.contratos.map((c) => c.fornecedorId));
  for (const f of input.fornecedores) {
    const mesAtual = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0');
    const n = input.despesas.filter(
      (d) =>
        d.fornecedor.trim().toLowerCase() === f.nome.trim().toLowerCase() &&
        d.vencimento.startsWith(mesAtual) &&
        d.status !== 'pago',
    ).length;
    if (n >= 3 && !fornecedoresComContrato.has(f.id)) {
      out.push({
        tipo: 'fornecedor_sem_contrato',
        severidade: 'info',
        mensagem: `Fornecedor ${f.nome} tem várias despesas no mês e não possui contrato ativo vinculado (por ID).`,
        referencia: f.id,
      });
    }
  }

  if (input.estouroCaixaPotencial) {
    out.push({
      tipo: 'risco_caixa',
      severidade: 'critical',
      mensagem:
        'Saídas projetadas (tesouraria) podem exceder entradas esperadas no horizonte próximo (proxy Fase 9).',
    });
  }

  return out;
}
