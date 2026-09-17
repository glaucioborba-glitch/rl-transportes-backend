export type GateContainerSituacao = "CHEIO" | "VAZIO";

export type GatePatioUnidade = {
  stack: string;
  posicao: string;
  unidadeId: string;
  container: string;
  tipo: string;
  status: string;
  refrigerado: boolean;
  cliente: string;
  diasNoPatio: number;
  entradaEm: string;
  processoNumero?: number | null;
  processo?: string;
  booking?: string;
  navio?: string;
  situacao?: string;
  tamanho?: string;
  tamanhoLabel?: string;
  tipoContainer?: string | null;
  tomadaReefer?: boolean;
};
