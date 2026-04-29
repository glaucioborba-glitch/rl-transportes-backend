/** Tipos Fase 19 — automação não destrutiva (memória; sem migrations). */

export type WorkflowAcaoTipo =
  | 'criar_faturamento_simulado'
  | 'enviar_webhook'
  | 'emitir_alerta'
  | 'gerar_os_simulada'
  | 'anexar_auditoria'
  | 'atualizar_status_operacional_simulado'
  | 'sugerir_nfse'
  | 'disparar_workflow'
  | 'log_destino_modulo';

export interface WorkflowCondicao {
  campo: string;
  /** eq | ne | gt | gte | lt | lte | contains */
  op: string;
  valor: unknown;
}

export interface WorkflowAcao {
  tipo: WorkflowAcaoTipo;
  params?: Record<string, unknown>;
}

export interface WorkflowDef {
  id: string;
  nome: string;
  eventoDisparo: string;
  condicoes: WorkflowCondicao[];
  acoes: WorkflowAcao[];
  prioridade: 1 | 2 | 3 | 4 | 5;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export type RegraTipo = 'operacional' | 'fiscal' | 'financeiro' | 'rh' | 'compliance';

export interface RegraNegocio {
  id: string;
  nome: string;
  tipo: RegraTipo;
  /** Expressão simples tipo: container.stay_hours>72 */
  if: string;
  then: string;
  else?: string;
  ativo: boolean;
  criadoEm: string;
}

export type RpaRobotId =
  | 'rpa_faturamento_auto'
  | 'rpa_nfse_sugestao'
  | 'rpa_reconcilia_boleto'
  | 'rpa_operacao_ciclo'
  | 'rpa_rh_absenteismo'
  | 'rpa_grc_incidentes';

export type RpaJobStatus = 'pendente' | 'executando' | 'sucesso' | 'falha';

export interface RpaJob {
  id: string;
  robotId: RpaRobotId;
  status: RpaJobStatus;
  iniciadoEm: string;
  finalizadoEm?: string;
  mensagem?: string;
  tentativa: number;
}

export type EstadoOperacionalIso =
  | 'criado'
  | 'portaria'
  | 'gate-in'
  | 'patio'
  | 'gate-out'
  | 'finalizado';

export interface CronJobDef {
  id: string;
  expressao: string;
  descricao: string;
  acao: string;
  ativo: boolean;
  proximaExecucaoProxy?: string;
  ultimaExecucaoProxy?: string;
}
