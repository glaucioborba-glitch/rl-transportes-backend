/** Linha normalizada extraída de um arquivo de retorno CNAB. */
export type CnabLinhaRetorno = {
  nossoNumero: string;
  valorPago: number;
  dataPagamento: Date;
  codigoMovimento?: string;
  ocorrencia?: string;
};

export type CnabFormatoDetectado = 'CNAB400' | 'CNAB240' | 'DESCONHECIDO';

export type LogProcessamentoCnab = {
  formatoDetectado?: CnabFormatoDetectado;
  linhasArquivo?: number;
  linhasParseadas?: number;
  faturasBaixadas: number;
  faturasNaoEncontradas: number;
  faturasValorDivergente: number;
  clientesDesbloqueados: number;
  erros: Array<{ nossoNumero: string; motivo: string }>;
  resumo: string;
};

export type ConciliacaoCnabResult = {
  faturasBaixadas: number;
  faturasNaoEncontradas: number;
  faturasValorDivergente: number;
  clientesDesbloqueados: number;
  erros: Array<{ nossoNumero: string; motivo: string }>;
  resumo: string;
};
