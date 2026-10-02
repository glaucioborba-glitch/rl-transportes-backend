import { CargoFuncionario, TurnoEscala } from '@prisma/client';

export type RiscoEscalaAlert = {
  data: string;
  turno: TurnoEscala;
  turnoLabel: string;
  cargo: CargoFuncionario;
  cargoLabel: string;
  demanda: number;
  capacidade: number;
  escalados: number;
  deficit: number;
  severidade: 'OK' | 'GARGALO';
  mensagem: string;
};

export type WorkforcePlanningSnapshot = {
  geradoEm: string;
  horizonteDias: number;
  alertas: RiscoEscalaAlert[];
};
