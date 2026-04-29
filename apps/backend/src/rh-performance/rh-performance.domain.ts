/** RH Performance — persistência em memória até migração Prisma. */

export type TurnoPerfRef = 'MANHA' | 'TARDE' | 'NOITE';

export type EscopoOkr = 'corporativo' | 'setorial' | 'individual';

export type StatusTreinamento = 'pendente' | 'concluido';

export interface AvaliacaoRhEntity {
  id: string;
  colaboradorId: string;
  /** Opcional: melhora KPIs por turno sem acoplamento à folha-rh */
  turnoReferencia?: TurnoPerfRef;
  cargoReferencia?: string;
  periodo: string;
  avaliador: string;
  notaTecnica: number;
  notaComportamental: number;
  aderenciaProcedimentos: number;
  qualidadeExecucao: number;
  comprometimento: number;
  comentarioGerencial?: string;
  scoreFinal: number;
  createdAt: string;
}

export interface OkrRhEntity {
  id: string;
  objetivo: string;
  escopo: EscopoOkr;
  keyResults: string[];
  progressoAtual: number;
  periodoInicio: string;
  periodoFim: string;
  responsavel: string;
  createdAt: string;
}

export interface TreinamentoRhEntity {
  id: string;
  colaboradorId: string;
  modulo: string;
  cargaHoraria: number;
  status: StatusTreinamento;
  dataConclusao?: string;
  createdAt: string;
}
