export type ContainerTipo = "DRY" | "REEFER" | "TANK";

export interface ContainerPilha {
  id: string;
  numero: string;
  tipo: ContainerTipo;
  /** Booking / cliente final (dono da carga). */
  clienteFinal: string;
  /** 1 = base da pilha (embaixo). */
  posicaoNaPilha: number;
}

export interface Pilha {
  id: string;
  codigo: string;
  containers: ContainerPilha[];
}

export interface PilhasResponse {
  pilhas: Pilha[];
  atualizadoEm: string;
}
