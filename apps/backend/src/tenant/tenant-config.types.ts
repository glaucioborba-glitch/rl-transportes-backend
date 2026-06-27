import { mergeReguaCobranca, type ReguaCobrancaConfig } from '../common/finance/regua-cobranca.util';

export type { ReguaCobrancaConfig };

export type TenantTurnoConfig = {
  id: string;
  nome: string;
  inicio: string;
  fim: string;
};

export type TenantParametros = {
  branding?: {
    corPrimaria?: string;
    logoUrl?: string;
  };
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

export function mergeTenantParametros(raw: unknown): TenantParametros {
  const base = structuredClone(DEFAULT_TENANT_PARAMETROS);
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as TenantParametros;
  return {
    branding: { ...base.branding, ...r.branding },
    operacao: {
      ...base.operacao,
      ...r.operacao,
      turnos: r.operacao?.turnos?.length ? r.operacao.turnos : base.operacao!.turnos,
    },
    reguaCobranca: mergeReguaCobranca(r.reguaCobranca),
  };
}
