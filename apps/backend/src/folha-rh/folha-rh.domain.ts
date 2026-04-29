/** RH Financeiro — persistência em memória até migração Prisma. */

export type TurnoRh = 'MANHA' | 'TARDE' | 'NOITE';

export type TipoContratacaoRh = 'CLT' | 'TEMPORARIO' | 'TERCEIRO';

export type TipoBeneficioRh = 'fixo' | 'percentual' | 'coparticipacao';

export interface ColaboradorRhEntity {
  id: string;
  nome: string;
  cpf: string;
  cargo: string;
  turno: TurnoRh;
  salarioBase: number;
  tipoContratacao: TipoContratacaoRh;
  dataAdmissao: string;
  dataDemissao?: string;
  beneficiosAtivos: string[];
  createdAt: string;
}

export interface BeneficioRhEntity {
  id: string;
  nomeBeneficio: string;
  valorMensal: number;
  tipoBeneficio: TipoBeneficioRh;
  createdAt: string;
}

export interface PresencaRhEntity {
  id: string;
  colaboradorId: string;
  data: string;
  horasTrabalhadas: number;
  horasExtras: number;
  adicionalNoturnoHoras: number;
  falta: boolean;
  createdAt: string;
}
