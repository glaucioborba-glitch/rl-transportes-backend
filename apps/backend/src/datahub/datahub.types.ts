/** Contratos lógicos do Datahub (simulação em memória — Fase 17). */

export type LakeOrigem =
  | 'operacional'
  | 'financeiro'
  | 'fiscal'
  | 'rh'
  | 'ia'
  | 'grc';

export interface LakeFileRecord {
  id: string;
  pathVirtual: string;
  origem: LakeOrigem;
  criadoEm: string;
  tamanhoBrutoBytes: number;
  gzipSimuladoRatio: number;
  bytesCompactadosAprox: number;
}

export type EtlFase = 'extrair' | 'transformar' | 'carregar';

export interface EtlExecucao {
  id: string;
  fase: EtlFase | 'pipeline';
  status: 'SUCESSO' | 'FALHA';
  iniciadoEm: string;
  finalizadoEm: string;
  duracaoMs: number;
  linhasEntrada?: number;
  linhasSaida?: number;
  mensagem?: string;
}

export type NomeFato =
  | 'FATO_Solicitacoes'
  | 'FATO_Gate'
  | 'FATO_Patio'
  | 'FATO_Saida'
  | 'FATO_Faturamento'
  | 'FATO_Boletos'
  | 'FATO_NFSe'
  | 'FATO_RH_Folha';

export type NomeDim =
  | 'DIM_Clientes'
  | 'DIM_Colaboradores'
  | 'DIM_Turnos'
  | 'DIM_Tempo';
