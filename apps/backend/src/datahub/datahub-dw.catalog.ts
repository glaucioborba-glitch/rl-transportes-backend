import type { NomeDim, NomeFato } from './datahub.types';

/** Catálogo Kimball lógico (star schema simulado — sem tabelas físicas). */
export const DW_CATALOGO_FATOS: Record<
  NomeFato,
  {
    descricao: string;
    granularidade: string;
    medidas: string[];
    dimensoes: NomeDim[];
  }
> = {
  FATO_Solicitacoes: {
    descricao: 'Eventos de solicitação de armazenagem por solicitação/status.',
    granularidade: 'evento (uma linha por solicitação ativa)',
    medidas: ['qt_unidades', 'flag_stage_portaria', 'flag_stage_gate', 'flag_stage_patio', 'flag_stage_saida'],
    dimensoes: ['DIM_Clientes', 'DIM_Tempo'],
  },
  FATO_Gate: {
    descricao: 'Passagens registradas no gate.',
    granularidade: 'evento gate único por solicitação',
    medidas: ['flag_ric_assinado'],
    dimensoes: ['DIM_Clientes', 'DIM_Tempo'],
  },
  FATO_Patio: {
    descricao: 'Posicionamento no pátio.',
    granularidade: 'evento posição por solicitação',
    medidas: ['slot_ocupado'],
    dimensoes: ['DIM_Clientes', 'DIM_Tempo'],
  },
  FATO_Saida: {
    descricao: 'Saídas físicas.',
    granularidade: 'evento por solicitação',
    medidas: ['duracao_minutos_proxy'],
    dimensoes: ['DIM_Clientes', 'DIM_Tempo'],
  },
  FATO_Faturamento: {
    descricao: 'Períodos faturados por cliente.',
    granularidade: 'período de faturamento',
    medidas: ['valor_total', 'qt_itens'],
    dimensoes: ['DIM_Clientes', 'DIM_Tempo'],
  },
  FATO_Boletos: {
    descricao: 'Boletos emitidos.',
    granularidade: 'boleto',
    medidas: ['valor_boleto', 'flag_vencido'],
    dimensoes: ['DIM_Clientes', 'DIM_Tempo'],
  },
  FATO_NFSe: {
    descricao: 'Notas fiscais emitidas.',
    granularidade: 'nf por linha emitida',
    medidas: ['flag_status_ipm'],
    dimensoes: ['DIM_Clientes', 'DIM_Tempo'],
  },
  FATO_RH_Folha: {
    descricao: 'Proxy de folha — headcount por papel de usuário interno.',
    granularidade: 'snapshot diário sintético',
    medidas: ['headcount', 'custo_medio_proxy'],
    dimensoes: ['DIM_Colaboradores', 'DIM_Tempo'],
  },
};

export const DW_CATALOGO_DIMENSOES: Record<
  NomeDim,
  { descricao: string; atributos: string[] }
> = {
  DIM_Clientes: {
    descricao: 'Cliente operacional/financeiro.',
    atributos: ['sk_cliente', 'cliente_natural_key', 'nome', 'tipo_documento'],
  },
  DIM_Colaboradores: {
    descricao: 'Usuários internos (proxy RH).',
    atributos: ['sk_colaborador', 'email_hash_proxy', 'role'],
  },
  DIM_Turnos: {
    descricao: 'Turnos padronizados (simulado).',
    atributos: ['sk_turno', 'codigo', 'janela_horario'],
  },
  DIM_Tempo: {
    descricao: 'Calendário gregoriano diário.',
    atributos: ['sk_tempo', 'data', 'ano', 'mes', 'dia', 'dia_semana'],
  },
};

/** Gera chaves substitutas determinísticas para testes e DW em memória. */
export function proximoSk(prefix: string, i: number): string {
  return `${prefix}_${String(i).padStart(9, '0')}`;
}
