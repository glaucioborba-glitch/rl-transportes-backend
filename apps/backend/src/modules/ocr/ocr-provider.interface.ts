export interface OCRResult {
  textoBruto: string;
  textoExtraido: string;
  confianca: number;
  provider: 'google_vision' | 'tesseract' | 'mock';
  sucesso: boolean;
  erro?: string;
}

export interface OCRRequest {
  imagem: string;
  tipo: 'CONTAINER' | 'PLACA';
  /** Valor esperado para comparar (alias: esperado no controller). */
  valorEsperado?: string;
}

export interface OCRProvider {
  name: OCRResult['provider'];
  processar(req: OCRRequest): Promise<OCRResult>;
}

export type OCRProcessarResponse = OCRResult & {
  ocrMatch: boolean;
  valorEsperado?: string;
};
