/**
 * Estados sequenciais do fluxo operacional.
 * Cada estado só pode ser atingido se o anterior foi concluído.
 */
export type OperacaoState =
  | 'SOLICITADA'
  | 'APROVADA'
  | 'AGUARDANDO_CHEGADA'
  | 'CHECKIN_PORTARIA'
  | 'VISTORIA_FOTOGRAFICA'
  | 'AGUARDANDO_RECONFIRMACAO'
  | 'RECONFIRMADA'
  | 'RIC_GERADO'
  | 'LIBERADA_OPERACAO'
  | 'EM_OPERACAO'
  | 'CONCLUIDA'
  | 'REJEITADA';

export const TRANSICOES_VALIDAS: Record<OperacaoState, OperacaoState[]> = {
  SOLICITADA: ['APROVADA', 'REJEITADA'],
  APROVADA: ['AGUARDANDO_CHEGADA'],
  AGUARDANDO_CHEGADA: ['CHECKIN_PORTARIA', 'REJEITADA'],
  CHECKIN_PORTARIA: ['VISTORIA_FOTOGRAFICA', 'REJEITADA'],
  VISTORIA_FOTOGRAFICA: ['AGUARDANDO_RECONFIRMACAO'],
  AGUARDANDO_RECONFIRMACAO: ['RECONFIRMADA', 'REJEITADA'],
  RECONFIRMADA: ['RIC_GERADO'],
  RIC_GERADO: ['LIBERADA_OPERACAO'],
  LIBERADA_OPERACAO: ['EM_OPERACAO'],
  EM_OPERACAO: ['CONCLUIDA'],
  CONCLUIDA: [],
  REJEITADA: [],
};

export function canTransition(from: OperacaoState, to: OperacaoState): boolean {
  const allowed = TRANSICOES_VALIDAS[from];
  return allowed?.includes(to) ?? false;
}

export function getEtapaNumero(state: OperacaoState): number {
  const map: Record<OperacaoState, number> = {
    SOLICITADA: 1,
    APROVADA: 2,
    AGUARDANDO_CHEGADA: 3,
    CHECKIN_PORTARIA: 3,
    VISTORIA_FOTOGRAFICA: 4,
    AGUARDANDO_RECONFIRMACAO: 5,
    RECONFIRMADA: 5,
    RIC_GERADO: 6,
    LIBERADA_OPERACAO: 7,
    EM_OPERACAO: 8,
    CONCLUIDA: 8,
    REJEITADA: 0,
  };
  return map[state] || 0;
}

export const STATE_LABELS: Record<OperacaoState, string> = {
  SOLICITADA: 'Solicitada',
  APROVADA: 'Aprovada',
  AGUARDANDO_CHEGADA: 'Aguardando Chegada',
  CHECKIN_PORTARIA: 'Check-in na Portaria',
  VISTORIA_FOTOGRAFICA: 'Vistoria Fotográfica',
  AGUARDANDO_RECONFIRMACAO: 'Aguardando Reconfirmação',
  RECONFIRMADA: 'Reconfirmada',
  RIC_GERADO: 'RIC Gerado',
  LIBERADA_OPERACAO: 'Liberada para Operação',
  EM_OPERACAO: 'Em Operação',
  CONCLUIDA: 'Concluída',
  REJEITADA: 'Rejeitada',
};

export const KANBAN_COLUNAS = [
  {
    id: 'AGUARDANDO',
    titulo: 'Aguardando Chegada',
    estados: ['APROVADA', 'AGUARDANDO_CHEGADA'] as OperacaoState[],
    cor: 'bg-amber-500/15',
  },
  {
    id: 'VISTORIA',
    titulo: 'Em Vistoria',
    estados: [
      'CHECKIN_PORTARIA',
      'VISTORIA_FOTOGRAFICA',
      'AGUARDANDO_RECONFIRMACAO',
      'RECONFIRMADA',
      'RIC_GERADO',
    ] as OperacaoState[],
    cor: 'bg-blue-500/15',
  },
  {
    id: 'OPERACAO',
    titulo: 'Em Operação',
    estados: ['LIBERADA_OPERACAO', 'EM_OPERACAO'] as OperacaoState[],
    cor: 'bg-purple-500/15',
  },
  {
    id: 'CONCLUIDA',
    titulo: 'Concluída / Liberado',
    estados: ['CONCLUIDA'] as OperacaoState[],
    cor: 'bg-green-500/15',
  },
] as const;

export function kanbanColumnForState(state: OperacaoState): string {
  for (const col of KANBAN_COLUNAS) {
    if (col.estados.includes(state)) return col.id;
  }
  return 'AGUARDANDO';
}
