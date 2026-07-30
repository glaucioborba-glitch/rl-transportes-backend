export const CONTAINER_TAMANHOS = ["20'", "40'", "45'"] as const;
export type ContainerTamanho = (typeof CONTAINER_TAMANHOS)[number];

export const CONTAINER_STATUS = ['CHEIO', 'VAZIO'] as const;
export type ContainerStatus = (typeof CONTAINER_STATUS)[number];

export type FaixaDiariaContract = {
  diaInicio: number;
  diaFim: number | null;
  valorDiaria: number;
};

export type MatrixPrecoCell = {
  tipoContainerCodigo: string;
  capacidadeCodigo?: string | null;
  containerTamanho: ContainerTamanho;
  statusContainer: ContainerStatus;
  valorHandling: number;
  freeTimeDias: number;
  faixasDiaria: FaixaDiariaContract[];
  tarifaEnergiaReeferDiaria?: number | null;
};
