/**
 * Estados sequenciais do fluxo operacional.
 * Cada estado só pode ser atingido se o anterior foi concluído,
 * exceto a devolução à portaria (reabre só a vistoria, sem rejeitar).
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
  AGUARDANDO_RECONFIRMACAO: ['RECONFIRMADA', 'REJEITADA', 'VISTORIA_FOTOGRAFICA'],
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

export type OperacaoFluxoJson = {
  qrToken?: string;
  qrValidade?: string;
  /** false = QR impresso pelo cliente ainda não vale na portaria (aguardando aprovação). */
  qrAtivo?: boolean;
  vistoria?: {
    fotos: Array<{
      tipo: string;
      imagem: string;
      ocrResult?: string;
      ocrMatch?: boolean;
      ocrConfianca?: number;
      ocrProvider?: string;
      ocrTextoBruto?: string;
      ocrExtras?: {
        tipoIso?: string;
        tamanhoPes?: string;
        perfil?: string;
        rotulo?: string;
        mgwKg?: string;
        taraKg?: string;
        payloadKg?: string;
        owner?: string;
      };
    }>;
    avarias: Array<{
      foto: string;
      descricao: string;
      localizacao: string;
      timestamp?: string;
    }>;
    enviadaEm?: string;
  };
  reconfirmacao?: {
    checklist: Record<string, boolean>;
    reconfirmadaEm?: string;
    operadorId?: string;
  };
  assinatura?: string;
  /** DIGITAL = impressão digital 1:1 no leitor; MANUAL = assinam o papel. */
  assinaturaModo?: 'DIGITAL' | 'MANUAL';
  assinaturaBiometria?: { cpf: string; verificadoEm: string; matched: true };
  assinaturaOperadorId?: string;
  ricGeradoEm?: string;
  tatInicio?: string;
  tatFim?: string;
  equipamentoId?: string;
  rejeicao?: { motivo: string; etapa: string; rejeitadaEm: string };
  /** Gate devolveu para complementar fotos — não é rejeição. */
  devolucaoPortaria?: {
    motivo: string;
    mensagem: string;
    devolvidaEm: string;
    operadorId?: string;
    fotosRefazer?: string[];
  } | null;
  correcoesGate?: {
    confirmados: string[];
    originais?: Record<string, string>;
    alteradoEm?: string;
    operadorId?: string;
    motivo?: string;
    gerenteId?: string;
    gerenteEmail?: string;
  };
  /** Anotação livre do Gate na conferência (não é dado da solicitação do cliente). */
  observacaoGate?: string;
  /** Linhas lançadas por serviço de pátio (troca de lacre, transbordo). Nunca sobrescrevem observacaoGate. */
  observacoesEfeito?: string[];
  /** Gate CPO — Agendamento Rápido Particular (walk-in). */
  walkInParticular?: boolean;
  pagamentoAvista?: 'PIX' | 'DINHEIRO';
  registradoEm?: string;
  telefoneMotorista?: string;
  pessoasAutorizadasRetirada?: Array<{ nome: string; cpf: string }>;
};
