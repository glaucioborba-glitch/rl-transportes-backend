import { Injectable, Logger } from '@nestjs/common';
import type { OCRProcessarResponse, OCRProvider, OCRRequest, OCRResult } from './ocr-provider.interface';
import { GoogleVisionProvider } from './providers/google-vision.provider';
import { TesseractProvider } from './providers/tesseract.provider';

const CONFIANCA_MINIMA = 0.5;

@Injectable()
export class OCRService {
  private readonly logger = new Logger(OCRService.name);
  private readonly providers: OCRProvider[];
  private readonly googleVision: GoogleVisionProvider;

  constructor() {
    this.googleVision = new GoogleVisionProvider();
    this.providers = [this.googleVision, new TesseractProvider()];
  }

  async processar(req: OCRRequest): Promise<OCRProcessarResponse> {
    this.logger.log(
      `[OCR] Processando imagem tipo=${req.tipo} esperado=${req.valorEsperado ?? 'N/A'}`,
    );

    let ultimoResultado: OCRResult | null = null;

    for (const provider of this.providers) {
      this.logger.log(`[OCR] Tentando provider: ${provider.name}`);

      const resultado = await provider.processar(req);
      ultimoResultado = resultado;

      if (resultado.sucesso && resultado.confianca >= CONFIANCA_MINIMA) {
        this.logger.log(
          `[OCR] ${provider.name} sucesso: texto="${resultado.textoExtraido}" confianca=${resultado.confianca}`,
        );
        const ocrMatch = this.compararValores(resultado.textoExtraido, req.valorEsperado);
        return { ...resultado, ocrMatch, valorEsperado: req.valorEsperado };
      }

      this.logger.warn(
        `[OCR] ${provider.name} falhou ou baixa confianca: ${resultado.erro ?? `confianca=${resultado.confianca}`}`,
      );
    }

    const ocrMatch = ultimoResultado
      ? this.compararValores(ultimoResultado.textoExtraido, req.valorEsperado)
      : false;

    return {
      textoBruto: ultimoResultado?.textoBruto ?? '',
      textoExtraido: ultimoResultado?.textoExtraido ?? '',
      confianca: ultimoResultado?.confianca ?? 0,
      provider: ultimoResultado?.provider ?? 'mock',
      sucesso: ultimoResultado?.sucesso ?? false,
      erro: ultimoResultado?.erro ?? 'Todos os providers falharam',
      ocrMatch,
      valorEsperado: req.valorEsperado,
    };
  }

  isGoogleVisionAvailable(): boolean {
    return this.googleVision.isAvailable();
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    if (this.isGoogleVisionAvailable()) {
      return { ok: true, message: 'Google Vision configurado (credenciais presentes)' };
    }
    return { ok: true, message: 'Tesseract local disponível (Vision não configurado)' };
  }

  private compararValores(extraido: string, esperado?: string): boolean {
    if (!esperado || !extraido) return false;
    const clean = (v: string) => v.toUpperCase().replace(/[\s\-]/g, '');
    return clean(extraido) === clean(esperado);
  }
}
