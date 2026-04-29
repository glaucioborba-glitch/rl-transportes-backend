/** GRC Compliance — persistência em memória até migração Prisma. */

export type CategoriaRisco =
  | 'operacional'
  | 'financeiro'
  | 'seguranca'
  | 'fiscal'
  | 'ambiental';

export type StatusRisco = 'aberto' | 'mitigando' | 'controlado';

export type OrigemRisco =
  | 'auditoria'
  | 'operacao'
  | 'fiscal'
  | 'financeiro'
  | 'seguranca_patrimonial';

export type FrequenciaControle = 'continuo' | 'diario' | 'semanal' | 'mensal';

export type StatusPlanoAcao = 'aberto' | 'em_andamento' | 'concluido';

export interface RiscoGrcEntity {
  id: string;
  titulo: string;
  descricao: string;
  categoria: CategoriaRisco;
  probabilidade: number;
  impacto: number;
  severidade: number;
  status: StatusRisco;
  responsavel: string;
  origem: OrigemRisco;
  createdAt: string;
}

export interface ControleInternoEntity {
  id: string;
  nomeControle: string;
  riscoRelacionadoId: string;
  frequencia: FrequenciaControle;
  responsavel: string;
  evidencia?: string;
  eficacia: number;
  createdAt: string;
}

export interface PlanoAcaoGrcEntity {
  id: string;
  what: string;
  why: string;
  where: string;
  when: string;
  who: string;
  how: string;
  howMuch: number;
  status: StatusPlanoAcao;
  createdAt: string;
}
