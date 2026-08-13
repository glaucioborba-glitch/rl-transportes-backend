import { EstagioCobranca } from '@prisma/client';
import { diffDiasAtraso } from './finance-profile.util';

export type ReguaCobrancaConfig = {
  ativo?: boolean;
  diasPreVencimento?: number;
  diasAtrasoLeve?: number;
  /** Dias antes do bloqueio automático para aviso final (default 1 ≈ 24h). */
  diasPreBloqueio?: number;
  etapas?: {
    preVencimento?: boolean;
    vencimentoHoje?: boolean;
    atrasoLeve?: boolean;
    preBloqueio?: boolean;
  };
};

export const ESTAGIO_COBRANCA_ORDER: EstagioCobranca[] = [
  EstagioCobranca.NENHUM,
  EstagioCobranca.PRE_VENCIMENTO,
  EstagioCobranca.VENCIMENTO_HOJE,
  EstagioCobranca.ATRASO_LEVE,
  EstagioCobranca.PRE_BLOQUEIO,
];

export type EstagioCobrancaNotificavel = Exclude<EstagioCobranca, typeof EstagioCobranca.NENHUM>;

export type ReguaCobrancaResolved = {
  ativo: boolean;
  diasPreVencimento: number;
  diasAtrasoLeve: number;
  /** Dias antes do bloqueio sistêmico para aviso final (ex.: 1 = 24h). */
  diasPreBloqueio: number;
  etapas: {
    preVencimento: boolean;
    vencimentoHoje: boolean;
    atrasoLeve: boolean;
    preBloqueio: boolean;
  };
};

export const DEFAULT_REGUA_COBRANCA: ReguaCobrancaResolved = {
  ativo: true,
  diasPreVencimento: 2,
  diasAtrasoLeve: 3,
  diasPreBloqueio: 1,
  etapas: {
    preVencimento: true,
    vencimentoHoje: true,
    atrasoLeve: true,
    preBloqueio: true,
  },
};

export function mergeReguaCobranca(raw: unknown): ReguaCobrancaResolved {
  const base = structuredClone(DEFAULT_REGUA_COBRANCA);
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as ReguaCobrancaConfig;
  return {
    ativo: r.ativo ?? base.ativo,
    diasPreVencimento: r.diasPreVencimento ?? base.diasPreVencimento,
    diasAtrasoLeve: r.diasAtrasoLeve ?? base.diasAtrasoLeve,
    diasPreBloqueio: r.diasPreBloqueio ?? base.diasPreBloqueio,
    etapas: {
      preVencimento: r.etapas?.preVencimento ?? base.etapas.preVencimento,
      vencimentoHoje: r.etapas?.vencimentoHoje ?? base.etapas.vencimentoHoje,
      atrasoLeve: r.etapas?.atrasoLeve ?? base.etapas.atrasoLeve,
      preBloqueio: r.etapas?.preBloqueio ?? base.etapas.preBloqueio,
    },
  };
}

export function diffDiasAteVencimento(dataVencimento: Date, asOf = new Date()): number {
  const venc = startOfDayUtc(dataVencimento);
  const hoje = startOfDayUtc(asOf);
  return Math.floor((venc.getTime() - hoje.getTime()) / 86_400_000);
}

export function estagioIndex(stage: EstagioCobranca): number {
  return ESTAGIO_COBRANCA_ORDER.indexOf(stage);
}

/**
 * Determina o próximo estágio de cobrança a notificar (pipeline ascendente).
 * Retorna null se nenhuma transição aplicável ou régua desativada.
 */
export function resolveProximoEstagioCobranca(input: {
  estagioAtual: EstagioCobranca;
  dataVencimento: Date;
  diasToleranciaBloqueio: number;
  regua: ReguaCobrancaResolved;
  asOf?: Date;
}): EstagioCobrancaNotificavel | null {
  const { estagioAtual, dataVencimento, diasToleranciaBloqueio, regua } = input;
  const asOf = input.asOf ?? new Date();
  if (!regua.ativo) return null;

  const diasAte = diffDiasAteVencimento(dataVencimento, asOf);
  const diasAtraso = diffDiasAtraso(dataVencimento, asOf);
  const atualIdx = estagioIndex(estagioAtual);

  const candidates: { stage: EstagioCobrancaNotificavel; enabled: boolean; match: boolean }[] = [
    {
      stage: EstagioCobranca.PRE_VENCIMENTO,
      enabled: regua.etapas.preVencimento,
      match: diasAte > 0 && diasAte === regua.diasPreVencimento,
    },
    {
      stage: EstagioCobranca.VENCIMENTO_HOJE,
      enabled: regua.etapas.vencimentoHoje,
      match: diasAte === 0,
    },
    {
      stage: EstagioCobranca.ATRASO_LEVE,
      enabled: regua.etapas.atrasoLeve,
      match: diasAtraso >= regua.diasAtrasoLeve,
    },
    {
      stage: EstagioCobranca.PRE_BLOQUEIO,
      enabled: regua.etapas.preBloqueio,
      match:
        diasAtraso > 0 &&
        diasAtraso >= Math.max(1, diasToleranciaBloqueio - regua.diasPreBloqueio + 1) &&
        diasAtraso <= diasToleranciaBloqueio,
    },
  ];

  let best: EstagioCobrancaNotificavel | null = null;
  let bestIdx = atualIdx;

  for (const c of candidates) {
    if (!c.enabled || !c.match) continue;
    const idx = estagioIndex(c.stage);
    if (idx > atualIdx && idx > bestIdx) {
      best = c.stage;
      bestIdx = idx;
    }
  }

  return best;
}

export function buildDunningMessage(
  stage: EstagioCobranca,
  input: {
    faturaNumero: string;
    valorExibicao: number;
    dataVencimento: Date;
    portalLink: string;
    diasAtraso: number;
  },
): string {
  const valor = input.valorExibicao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const dataFmt = input.dataVencimento.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  switch (stage) {
    case EstagioCobranca.PRE_VENCIMENTO:
      return `Olá. Lembramos que a fatura ${input.faturaNumero}, no valor de ${valor}, vence em ${dataFmt}. O boleto está disponível no portal: ${input.portalLink}`;
    case EstagioCobranca.VENCIMENTO_HOJE:
      return `Olá. A fatura ${input.faturaNumero}, no valor de ${valor}, vence hoje (${dataFmt}). Regularize pelo portal: ${input.portalLink}`;
    case EstagioCobranca.ATRASO_LEVE:
      return `Identificamos que a fatura ${input.faturaNumero} encontra-se em aberto. O valor atualizado com encargos é ${valor}. Evite a suspensão dos serviços. Portal: ${input.portalLink}`;
    case EstagioCobranca.PRE_BLOQUEIO:
      return `⚠️ URGENTE: Sua fatura ${input.faturaNumero} está com ${input.diasAtraso} dias de atraso. O bloqueio sistêmico de agendamento e liberação de cargas ocorrerá em 24h caso não seja regularizada. Valor atualizado: ${valor}. Portal: ${input.portalLink}`;
    default:
      return '';
  }
}

function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
