export type FiscalEmissaoResult =
  | {
      mode: 'emitida';
      numeroNfse: string;
      linkNfse: string;
      codVerificador?: string;
      xmlResposta: string;
      rpsNumero: string;
      rpsSerie: string;
    }
  | {
      mode: 'pendente';
      rpsNumero: string;
      rpsSerie: string;
      codVerificador?: string;
      xmlResposta: string;
    };

export type BoletoRegistroResult = {
  numeroBoleto: string;
  linkPdf: string;
  pixCopiaCola: string;
  pixQrCodeUrl: string;
  dataVencimento: Date;
  provedor: string;
  referenciaExterna: string;
};
