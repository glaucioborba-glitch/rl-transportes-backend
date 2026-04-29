/** Cálculos GRC — testáveis e determinísticos (engine de compliance usa também leituras Prisma no service). */

/** Severidade de risco cadastrado = probabilidade × impacto (escala 1–25). */
export function severidadeRisco(probabilidade: number, impacto: number): number {
  return probabilidade * impacto;
}

/** Média da eficácia dos controles (0–100); lista vazia → `null` (service aplica default env). */
export function mediaEficaciaControles(eficacias: number[]): number | null {
  if (eficacias.length === 0) return null;
  const s = eficacias.reduce((a, e) => a + e, 0);
  return Math.round((s / eficacias.length) * 100) / 100;
}

export type SeveridadeIncidente = 'baixa' | 'media' | 'alta' | 'critica';

export interface IncidenteComplianceCalc {
  codigo: string;
  severidade: SeveridadeIncidente;
  area: string;
  descricao: string;
  fonteDados: string;
}

const PESO_SEVERIDADE: Record<SeveridadeIncidente, number> = {
  baixa: 2,
  media: 5,
  alta: 11,
  critica: 20,
};

/** Score 0–100: quanto mais incidentes graves, menor o score. */
export function calcularScoreCompliance(incidentes: IncidenteComplianceCalc[]): number {
  const penal = incidentes.reduce((s, i) => s + (PESO_SEVERIDADE[i.severidade] ?? 5), 0);
  return Math.max(0, Math.min(100, Math.round(100 - penal)));
}

export function areasCriticasDeIncidentes(
  incidentes: IncidenteComplianceCalc[],
): string[] {
  const set = new Set<string>();
  for (const i of incidentes) {
    if (i.severidade === 'alta' || i.severidade === 'critica') set.add(i.area);
  }
  return [...set];
}

export function recomendacoesPorIncidentes(incidentes: IncidenteComplianceCalc[]): string[] {
  const out: string[] = [];
  const codes = new Set(incidentes.map((i) => i.codigo));
  if (codes.has('FIN-BOLETO-VENC')) {
    out.push('Priorizar conciliação/baixa de boletos vencidos e alinhar tesouraria com financeiro.');
  }
  if (codes.has('FIN-NF-PEND')) {
    out.push('Acionar emissão regularização de NFS-e pendentes antes do fechamento fiscal.');
  }
  if (codes.has('OPS-GATE-RIC')) {
    out.push('Reforçar controles de gate: exigir RIC assinado antes de conclusão operacional.');
  }
  if (codes.has('OPS-OCR-BACKLOG')) {
    out.push('Dimensionar fila OCR na portaria ou fallback manual supervisionado.');
  }
  if (codes.has('RH-AUS-PROXY')) {
    out.push('Integrar folha-RH: revisar absenteísmo e turnos críticos.');
  }
  if (codes.has('SEG-INC-PROXY')) {
    out.push('Ativar roteiro ISPS: revisão perimetral e drill de acesso.');
  }
  if (codes.has('FISC-NFS-REJ')) {
    out.push('Tratar NFS-e rejeitadas com fiscal/governança e reprocesso.');
  }
  return out;
}

export interface GapCertificacaoResultado {
  indiceAderenciaISO: number;
  indiceAderenciaOEA: number;
  indiceAderenciaISPS: number;
  gaps: string[];
  planoAcaoSugerido5w2h: {
    what: string;
    why: string;
    where: string;
    when: string;
    who: string;
    how: string;
    howMuch: number;
  };
}

/** Combina eficácia média dos controles, score de compliance e cobertura de riscos mitigation. */
export function calcularIndicesCertificacao(input: {
  eficaciaMediaControles: number;
  scoreCompliance: number;
  pctRiscosMitigadosOuControlados: number;
}): Pick<GapCertificacaoResultado, 'indiceAderenciaISO' | 'indiceAderenciaOEA' | 'indiceAderenciaISPS'> {
  const { eficaciaMediaControles: e, scoreCompliance: s, pctRiscosMitigadosOuControlados: r } = input;
  const iso =
    Math.round((0.35 * e + 0.35 * s + 0.3 * r) * 100) / 100;
  const oea =
    Math.round((0.3 * e + 0.25 * s + 0.45 * r) * 100) / 100;
  const isps =
    Math.round((0.28 * e + 0.22 * s + 0.5 * r) * 100) / 100;
  return {
    indiceAderenciaISO: Math.min(100, iso),
    indiceAderenciaOEA: Math.min(100, oea),
    indiceAderenciaISPS: Math.min(100, isps),
  };
}

export function listarGapsCertificacao(indices: {
  indiceAderenciaISO: number;
  indiceAderenciaOEA: number;
  indiceAderenciaISPS: number;
}): string[] {
  const gaps: string[] = [];
  if (indices.indiceAderenciaISO < 75)
    gaps.push(
      'ISO 9001: reforçar documentação de processos e evidências de auditorias internas registradas.',
    );
  if (indices.indiceAderenciaOEA < 75)
    gaps.push(
      'OEA: fortalecer rastreabilidade da cadeia logística e segregação de controles aduaneiros.',
    );
  if (indices.indiceAderenciaISPS < 75)
    gaps.push(
      'ISPS-Code: revisar plano de proteção portuária, controle de acesso e simulações de incidente.',
    );
  return gaps;
}

export function plano5w2hSugeridoParaGaps(piorIndice: string): GapCertificacaoResultado['planoAcaoSugerido5w2h'] {
  return {
    what: `Plano de adequação ao framework ${piorIndice} com controles monitorados no GRC.`,
    why: 'Reduzir exposição regulatória e elevar maturidade de auditoria interna.',
    where: 'Terminal / áreas operacionais e financeiras integradas.',
    when: 'Próximo ciclo trimestral (definir data em comitê GRC).',
    who: 'Responsável compliance + líderes de área.',
    how: 'Matriz de controles + evidências + treinamentos RH-performance.',
    howMuch: 0,
  };
}

export function mapaRiscoCorporativoPorSeveridade(
  severidades: number[],
): Record<string, number> {
  const m: Record<string, number> = {
    '1-6': 0,
    '7-12': 0,
    '13-18': 0,
    '19-25': 0,
  };
  for (const s of severidades) {
    if (s <= 6) m['1-6'] += 1;
    else if (s <= 12) m['7-12'] += 1;
    else if (s <= 18) m['13-18'] += 1;
    else m['19-25'] += 1;
  }
  return m;
}
