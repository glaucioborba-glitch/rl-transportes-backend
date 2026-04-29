/** Origem lógica para logs corporativos (Fase 15). */
export const LOG_ORIGENS = [
  'auth',
  'operacional',
  'financeiro',
  'fiscal',
  'ia',
  'simulador',
  'mobile',
  'rh',
  'integracao',
  'observabilidade',
  'outros',
] as const;

export type LogOrigem = (typeof LOG_ORIGENS)[number];

export type LogSeveridade = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

export interface LogEstruturado {
  timestamp: string;
  origem: LogOrigem;
  severidade: LogSeveridade;
  mensagem: string;
  requestId: string;
  /** metadados não sensíveis */
  contexto?: Record<string, unknown>;
  usuarioId?: string;
  usuarioEmail?: string;
  clienteId?: string;
  metodo?: string;
  rota?: string;
  statusHttp?: number;
  duracaoMs?: number;
}

export interface HttpMetricBucket {
  rotaNormalizada: string;
  /** soma das latências (ms) */
  latenciaMsSum: number;
  contagem: number;
  /** status -> count */
  status: Record<number, number>;
}

export interface TraceSpanRecord {
  id: string;
  traceId: string;
  parentId: string | null;
  nome: string;
  layer: 'http' | 'banco' | 'servico' | 'integracao' | 'mobile' | 'webhooks';
  inicioMs: number;
  duracaoMs: number;
}

export interface TraceCompleto {
  traceId: string;
  requestId: string;
  rootSpanId: string;
  spans: TraceSpanRecord[];
  fluxoResumo: string;
}

export type AlertaTipo =
  | 'degradacao_rota'
  | 'latencia_alta'
  | 'erro_operacional'
  | 'excecao_critica';

export interface AlertaRegistro {
  id: string;
  tipo: AlertaTipo;
  severidade: LogSeveridade;
  mensagem: string;
  criadoEm: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export type HealthStatusSignal = 'OK' | 'DEGRADED' | 'FAIL';
