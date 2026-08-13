import { mergeReguaCobranca, type ReguaCobrancaConfig } from '../common/finance/regua-cobranca.util';

export type { ReguaCobrancaConfig };

export type TenantTurnoConfig = {
  id: string;
  nome: string;
  inicio: string;
  fim: string;
};

export type TenantFeriadoMunicipal = {
  data: string;
  nome: string;
};

export type TenantTurnoOperacionalConfig = {
  id: string;
  codigo: string;
  /** Mapeia para enum TurnoAgendamento (MANHA/TARDE) na reserva. */
  slot: 'MANHA' | 'TARDE';
  nome: string;
  horaInicio: string;
  horaFim: string;
  capacidadeMaxima: number;
  diasSemana: string[];
  ativo: boolean;
};

export type ToleranciaChegadaConfig = {
  tipo: 'dia' | 'turno' | 'horario';
  valorMin: number;
  ativo: boolean;
};

export type AtendimentoEspecialAudit = {
  motivo: string;
  aprovadoPor: string;
  dataAprovacao: string;
};

export type TenantParametrosOperacional = {
  capacidadeTotalSlots: number;
  teuMaximoSimultaneo: number;
  horarioFuncionamentoInicio: string;
  horarioFuncionamentoFim: string;
  freeTimePadraoDias: number;
  /** Meta TAT Entrada (min) — ex.: 120 */
  tatAlvoEntradaMin: number;
  /** Meta TAT Saída (min) */
  tatAlvoSaidaMin: number;
  /** Meta TAT Remoção (min) */
  tatAlvoRemocaoMin: number;
  limiteAgendamentosPorTurno: number;
  /** Restringe novos agendamentos em fim de semana — não afeta contagem de diárias. */
  operacaoFimSemana: boolean;
  /** Texto explicativo (UI) sobre operação/cobrança em fim de semana. */
  descricaoFimSemana?: string;
  toleranciaChegada: ToleranciaChegadaConfig;
  /** @deprecated use antecedenciaMinimaMin */
  tempoToleranciaChegadaMin?: number;
  /** @deprecated use antecedenciaMinimaMin */
  antecedenciaMinimaAgendamentoH?: number;
  /** @deprecated use cancelamentoSemPenalidadeMin */
  cancelamentoSemPenalidadeH?: number;
  /** @deprecated */
  tatAlvoBaixaHoras?: number;
  /** @deprecated */
  tatAlvoColetaHoras?: number;
  /** @deprecated */
  tatAlvoTransferenciaHoras?: number;
  antecedenciaMinimaMin: number;
  cancelamentoSemPenalidadeMin: number;
  validarAntecedenciaAgendamento: boolean;
  validarCancelamentoSemPenalidade: boolean;
  turnos: TenantTurnoOperacionalConfig[];
  feriadosMunicipais: TenantFeriadoMunicipal[];
};

export type TenantParametrosFinanceiro = {
  diasToleranciaBloqueioPadrao: number;
  percentualMultaAtrasoPadrao: number;
  percentualJurosAoMesPadrao: number;
  condicaoPagamentoDefault: string;
  tabelaPrecoAtivaId: string | null;
  emiteNfseAutomatico: boolean;
  emiteBoletoAutomatico: boolean;
  diasVencimentoBoletoPadrao: number;
};

export type TenantParametros = {
  branding?: {
    corPrimaria?: string;
    logoUrl?: string;
  };
  operacional?: Partial<TenantParametrosOperacional>;
  financeiro?: Partial<TenantParametrosFinanceiro>;
  operacao?: {
    turnos?: TenantTurnoConfig[];
    exigeInspecaoGateIn?: boolean;
    diasFreeTimePadrao?: number;
    /** Dias após vencimento do boleto para bloqueio financeiro automático (CRON). */
    diasInadimplenciaBloqueio?: number;
    /** Alias explícito de diasInadimplenciaBloqueio (Motor Financeiro V2). */
    diasToleranciaBloqueioPadrao?: number;
    /** Multa por atraso padrão (%), ex.: 2.00 = 2%. */
    percentualMultaAtrasoPadrao?: number;
    /** Juros ao mês padrão (% a.m.), ex.: 1.00 = 1%. */
    percentualJurosAoMesPadrao?: number;
  };
  reguaCobranca?: ReguaCobrancaConfig;
  nfse?: {
    certificadoBase64?: string;
    certificadoSenha?: string;
  };
  fiscal?: Partial<TenantParametrosFiscal>;
  seguranca?: Partial<TenantParametrosSeguranca>;
  notificacoes?: Partial<TenantParametrosNotificacoes>;
};

export type CertificadoStatus = 'VALIDO' | 'VENCIDO' | 'AUSENTE' | 'DESCONHECIDO';

export type TenantParametrosFiscal = {
  municipioIbge: string;
  provedor: 'IPM' | 'ATENDE_NET' | 'NONE';
  regimeTributario: string;
  aliquotaIssPadrao: number;
  certificadoStatus: CertificadoStatus;
  certificadoValidade?: string;
};

export type TenantParametrosSeguranca = {
  tentativasLoginAntesBloqueio: number;
  duracaoBloqueioMin: number;
  sessoesMaximasConcorrentes: number;
  ttlSessaoHoras: number;
  senhaMinLength: number;
  senhaExigirMaiuscula: boolean;
  senhaExigirNumero: boolean;
  senhaExigirEspecial: boolean;
  senhaBloquearSequencias: boolean;
  validarDominioCorporativo: boolean;
};

export type TenantIntegracaoStatus = {
  enabled: boolean;
  phoneNumberId?: string;
  templatesAprovados?: number;
  apiKeyPresent?: boolean;
  provider?: string;
  bucket?: string;
  endpoint?: string;
};

export type TenantParametrosIntegracoes = {
  whatsapp: TenantIntegracaoStatus & { phoneNumberId?: string; templatesAprovados: number };
  googleVision: TenantIntegracaoStatus & { apiKeyPresent: boolean };
  banking: TenantIntegracaoStatus & { provider?: string };
  s3: TenantIntegracaoStatus & { bucket?: string; endpoint?: string };
};

export type WhatsAppTemplateStatus = 'APPROVED' | 'PENDING' | 'REJECTED' | 'DISABLED';

export type TenantParametrosNotificacoes = {
  emailsAlerta: string[];
  webhookSlackUrl?: string;
  webhookSlackEnabled: boolean;
  debounceAlertasMin: number;
  templatesWhatsApp: { name: string; status: WhatsAppTemplateStatus }[];
};

export const DEFAULT_TURNOS_OPERACIONAL: TenantTurnoOperacionalConfig[] = [
  {
    id: 't1',
    codigo: 'T1',
    slot: 'MANHA',
    nome: 'Operacional Manhã',
    horaInicio: '07:00',
    horaFim: '14:00',
    capacidadeMaxima: 8,
    diasSemana: ['SEG', 'TER', 'QUA', 'QUI', 'SEX'],
    ativo: true,
  },
  {
    id: 't2',
    codigo: 'T2',
    slot: 'TARDE',
    nome: 'Operacional Tarde',
    horaInicio: '14:00',
    horaFim: '20:00',
    capacidadeMaxima: 7,
    diasSemana: ['SEG', 'TER', 'QUA', 'QUI', 'SEX'],
    ativo: true,
  },
  {
    id: 't3',
    codigo: 'T3',
    slot: 'MANHA',
    nome: 'Sábado Manhã',
    horaInicio: '07:00',
    horaFim: '12:00',
    capacidadeMaxima: 5,
    diasSemana: ['SAB'],
    ativo: true,
  },
  {
    id: 't4',
    codigo: 'T4',
    slot: 'TARDE',
    nome: 'Sábado Tarde',
    horaInicio: '13:00',
    horaFim: '16:00',
    capacidadeMaxima: 3,
    diasSemana: ['SAB'],
    ativo: true,
  },
];

export const DEFAULT_TOLERANCIA_CHEGADA: ToleranciaChegadaConfig = {
  tipo: 'dia',
  valorMin: 0,
  ativo: false,
};

export const DEFAULT_OPERACIONAL: TenantParametrosOperacional = {
  capacidadeTotalSlots: 280,
  teuMaximoSimultaneo: 560,
  horarioFuncionamentoInicio: '06:00',
  horarioFuncionamentoFim: '22:00',
  freeTimePadraoDias: 7,
  tatAlvoEntradaMin: 120,
  tatAlvoSaidaMin: 120,
  tatAlvoRemocaoMin: 60,
  limiteAgendamentosPorTurno: 15,
  operacaoFimSemana: false,
  toleranciaChegada: DEFAULT_TOLERANCIA_CHEGADA,
  antecedenciaMinimaMin: 60,
  cancelamentoSemPenalidadeMin: 120,
  validarAntecedenciaAgendamento: true,
  validarCancelamentoSemPenalidade: true,
  turnos: DEFAULT_TURNOS_OPERACIONAL,
  feriadosMunicipais: [],
};

export const DEFAULT_FINANCEIRO: TenantParametrosFinanceiro = {
  diasToleranciaBloqueioPadrao: 3,
  percentualMultaAtrasoPadrao: 2,
  percentualJurosAoMesPadrao: 1,
  condicaoPagamentoDefault: 'FATURAMENTO',
  tabelaPrecoAtivaId: null,
  emiteNfseAutomatico: true,
  emiteBoletoAutomatico: true,
  diasVencimentoBoletoPadrao: 7,
};

export const DEFAULT_FISCAL: TenantParametrosFiscal = {
  municipioIbge: '4211306',
  provedor: 'IPM',
  regimeTributario: 'SIMPLES_NACIONAL',
  aliquotaIssPadrao: 2,
  certificadoStatus: 'AUSENTE',
};

export const DEFAULT_SEGURANCA: TenantParametrosSeguranca = {
  tentativasLoginAntesBloqueio: 5,
  duracaoBloqueioMin: 15,
  sessoesMaximasConcorrentes: 10,
  ttlSessaoHoras: 168,
  senhaMinLength: 8,
  senhaExigirMaiuscula: true,
  senhaExigirNumero: true,
  senhaExigirEspecial: true,
  senhaBloquearSequencias: true,
  validarDominioCorporativo: true,
};

export const DEFAULT_NOTIFICACOES: TenantParametrosNotificacoes = {
  emailsAlerta: [],
  webhookSlackEnabled: false,
  debounceAlertasMin: 15,
  templatesWhatsApp: [],
};

export const DEFAULT_TENANT_PARAMETROS: TenantParametros = {
  branding: { corPrimaria: '#14b8a6' },
  operacao: {
    turnos: [
      { id: 'MANHA', nome: 'Manhã', inicio: '06:00', fim: '14:00' },
      { id: 'TARDE', nome: 'Tarde', inicio: '14:00', fim: '22:00' },
    ],
    exigeInspecaoGateIn: true,
    diasFreeTimePadrao: 7,
    diasInadimplenciaBloqueio: 30,
    percentualMultaAtrasoPadrao: 2,
    percentualJurosAoMesPadrao: 1,
  },
};

export function resolveCertificadoStatus(nfse?: TenantParametros['nfse']): CertificadoStatus {
  const b64 = nfse?.certificadoBase64?.trim();
  if (!b64) return 'AUSENTE';
  return 'DESCONHECIDO';
}

export function resolveFiscal(raw: TenantParametros, envMunicipio?: string): TenantParametrosFiscal {
  return {
    ...DEFAULT_FISCAL,
    ...raw.fiscal,
    municipioIbge: raw.fiscal?.municipioIbge ?? envMunicipio ?? DEFAULT_FISCAL.municipioIbge,
    certificadoStatus: raw.fiscal?.certificadoStatus ?? resolveCertificadoStatus(raw.nfse),
  };
}

export function resolveSeguranca(raw: TenantParametros): TenantParametrosSeguranca {
  return { ...DEFAULT_SEGURANCA, ...raw.seguranca };
}

export function resolveNotificacoes(raw: TenantParametros): TenantParametrosNotificacoes {
  return {
    ...DEFAULT_NOTIFICACOES,
    ...raw.notificacoes,
    emailsAlerta: raw.notificacoes?.emailsAlerta ?? DEFAULT_NOTIFICACOES.emailsAlerta,
    templatesWhatsApp: raw.notificacoes?.templatesWhatsApp ?? DEFAULT_NOTIFICACOES.templatesWhatsApp,
  };
}

export function resolveOperacional(raw: TenantParametros): TenantParametrosOperacional {
  const op = raw.operacao;
  const partial = raw.operacional ?? {};
  const turnos =
    partial.turnos?.length ? normalizeTurnosOperacionais(partial.turnos) : DEFAULT_TURNOS_OPERACIONAL;

  const tatEntrada =
    partial.tatAlvoEntradaMin ??
    (partial.tatAlvoBaixaHoras != null ? Math.round(partial.tatAlvoBaixaHoras * 60) : undefined);
  const tatSaida =
    partial.tatAlvoSaidaMin ??
    (partial.tatAlvoColetaHoras != null ? Math.round(partial.tatAlvoColetaHoras * 60) : undefined);
  const tatRemocao =
    partial.tatAlvoRemocaoMin ??
    (partial.tatAlvoTransferenciaHoras != null
      ? Math.round(partial.tatAlvoTransferenciaHoras * 60)
      : undefined);

  const antecedenciaMin =
    partial.antecedenciaMinimaMin ??
    (partial.antecedenciaMinimaAgendamentoH != null
      ? partial.antecedenciaMinimaAgendamentoH * 60
      : undefined);
  const cancelamentoMin =
    partial.cancelamentoSemPenalidadeMin ??
    (partial.cancelamentoSemPenalidadeH != null
      ? partial.cancelamentoSemPenalidadeH * 60
      : undefined);

  const toleranciaChegada: ToleranciaChegadaConfig = partial.toleranciaChegada
    ? { ...DEFAULT_TOLERANCIA_CHEGADA, ...partial.toleranciaChegada }
    : partial.tempoToleranciaChegadaMin != null
      ? { tipo: 'horario', valorMin: partial.tempoToleranciaChegadaMin, ativo: true }
      : DEFAULT_TOLERANCIA_CHEGADA;

  return {
    ...DEFAULT_OPERACIONAL,
    ...partial,
    turnos,
    feriadosMunicipais: partial.feriadosMunicipais ?? DEFAULT_OPERACIONAL.feriadosMunicipais,
    tatAlvoEntradaMin: tatEntrada ?? DEFAULT_OPERACIONAL.tatAlvoEntradaMin,
    tatAlvoSaidaMin: tatSaida ?? DEFAULT_OPERACIONAL.tatAlvoSaidaMin,
    tatAlvoRemocaoMin: tatRemocao ?? DEFAULT_OPERACIONAL.tatAlvoRemocaoMin,
    toleranciaChegada,
    antecedenciaMinimaMin: antecedenciaMin ?? DEFAULT_OPERACIONAL.antecedenciaMinimaMin,
    cancelamentoSemPenalidadeMin:
      cancelamentoMin ?? DEFAULT_OPERACIONAL.cancelamentoSemPenalidadeMin,
    validarAntecedenciaAgendamento:
      partial.validarAntecedenciaAgendamento ?? DEFAULT_OPERACIONAL.validarAntecedenciaAgendamento,
    validarCancelamentoSemPenalidade:
      partial.validarCancelamentoSemPenalidade ??
      DEFAULT_OPERACIONAL.validarCancelamentoSemPenalidade,
    freeTimePadraoDias:
      partial.freeTimePadraoDias ?? op?.diasFreeTimePadrao ?? DEFAULT_OPERACIONAL.freeTimePadraoDias,
    horarioFuncionamentoInicio:
      partial.horarioFuncionamentoInicio ?? DEFAULT_OPERACIONAL.horarioFuncionamentoInicio,
    horarioFuncionamentoFim:
      partial.horarioFuncionamentoFim ?? DEFAULT_OPERACIONAL.horarioFuncionamentoFim,
  };
}

function normalizeTurnosOperacionais(
  turnos: TenantTurnoOperacionalConfig[],
): TenantTurnoOperacionalConfig[] {
  return turnos.map((t) => ({
    ...t,
    slot:
      t.slot ??
      (t.codigo === 'MANHA' || t.codigo === 'TARDE' ? t.codigo : inferSlotFromHorario(t.horaInicio)),
  }));
}

function inferSlotFromHorario(horaInicio: string): 'MANHA' | 'TARDE' {
  const h = parseInt(horaInicio.split(':')[0] ?? '12', 10);
  return h < 12 ? 'MANHA' : 'TARDE';
}

export function turnosOperacionaisToLegacy(
  turnos: TenantTurnoOperacionalConfig[],
): TenantTurnoConfig[] {
  return turnos
    .filter((t) => t.ativo)
    .map((t) => ({
      id: t.codigo,
      nome: t.nome,
      inicio: t.horaInicio,
      fim: t.horaFim,
    }));
}

export function resolveFinanceiro(raw: TenantParametros): TenantParametrosFinanceiro {
  const op = raw.operacao;
  return {
    ...DEFAULT_FINANCEIRO,
    ...raw.financeiro,
    diasToleranciaBloqueioPadrao:
      raw.financeiro?.diasToleranciaBloqueioPadrao ??
      op?.diasToleranciaBloqueioPadrao ??
      op?.diasInadimplenciaBloqueio ??
      DEFAULT_FINANCEIRO.diasToleranciaBloqueioPadrao,
    percentualMultaAtrasoPadrao:
      raw.financeiro?.percentualMultaAtrasoPadrao ??
      op?.percentualMultaAtrasoPadrao ??
      DEFAULT_FINANCEIRO.percentualMultaAtrasoPadrao,
    percentualJurosAoMesPadrao:
      raw.financeiro?.percentualJurosAoMesPadrao ??
      op?.percentualJurosAoMesPadrao ??
      DEFAULT_FINANCEIRO.percentualJurosAoMesPadrao,
  };
}

export function mergeTenantParametros(raw: unknown): TenantParametros {
  const base = structuredClone(DEFAULT_TENANT_PARAMETROS);
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as TenantParametros;
  const merged: TenantParametros = {
    branding: { ...base.branding, ...r.branding },
    operacional: { ...base.operacional, ...r.operacional },
    financeiro: { ...base.financeiro, ...r.financeiro },
    fiscal: { ...DEFAULT_FISCAL, ...r.fiscal },
    seguranca: { ...DEFAULT_SEGURANCA, ...r.seguranca },
    notificacoes: { ...DEFAULT_NOTIFICACOES, ...r.notificacoes },
    operacao: {
      ...base.operacao,
      ...r.operacao,
      turnos: r.operacao?.turnos?.length ? r.operacao.turnos : base.operacao!.turnos,
    },
    reguaCobranca: mergeReguaCobranca(r.reguaCobranca),
    nfse: r.nfse ? { ...r.nfse } : undefined,
  };
  return syncLegacyOperacaoFields(merged);
}

/** Mantém operacao.* legado alinhado com operacional/financeiro para consumidores existentes. */
export function syncLegacyOperacaoFields(parametros: TenantParametros): TenantParametros {
  const operacional = resolveOperacional(parametros);
  const financeiro = resolveFinanceiro(parametros);
  return {
    ...parametros,
    operacional,
    financeiro,
    operacao: {
      ...parametros.operacao,
      turnos: turnosOperacionaisToLegacy(operacional.turnos),
      diasFreeTimePadrao: operacional.freeTimePadraoDias,
      diasInadimplenciaBloqueio: financeiro.diasToleranciaBloqueioPadrao,
      diasToleranciaBloqueioPadrao: financeiro.diasToleranciaBloqueioPadrao,
      percentualMultaAtrasoPadrao: financeiro.percentualMultaAtrasoPadrao,
      percentualJurosAoMesPadrao: financeiro.percentualJurosAoMesPadrao,
    },
  };
}
