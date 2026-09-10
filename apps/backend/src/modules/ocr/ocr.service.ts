import { Injectable, Logger } from '@nestjs/common';
import { IntegrationCredentialsService } from '../../tenant/integration-credentials.service';
import type { OCRProcessarResponse, OCRProvider, OCRRequest, OCRResult } from './ocr-provider.interface';
import { GoogleVisionProvider } from './providers/google-vision.provider';
import { TesseractProvider } from './providers/tesseract.provider';

const CONFIANCA_MINIMA = 0.5;

@Injectable()
export class OCRService {
  private readonly logger = new Logger(OCRService.name);
  private readonly providers: OCRProvider[];
  private readonly googleVision: GoogleVisionProvider;

  constructor(private readonly integrationCreds: IntegrationCredentialsService) {
    this.googleVision = new GoogleVisionProvider();
    this.providers = [this.googleVision, new TesseractProvider()];
  }

  async ensureGoogleVision(): Promise<boolean> {
    const resolved = await this.integrationCreds.resolveGoogleVision();
    if (resolved.credentials) {
      this.googleVision.apply({
        kind: 'json',
        credentials: resolved.credentials,
        fingerprint: `json:${resolved.clientEmail ?? 'tenant'}`,
      });
    } else if (resolved.useApplicationDefault) {
      this.googleVision.apply({ kind: 'adc', fingerprint: 'adc' });
    } else if (resolved.apiKey) {
      this.googleVision.apply({
        kind: 'apiKey',
        apiKey: resolved.apiKey,
        fingerprint: `key:${resolved.apiKey.slice(0, 8)}`,
      });
    } else {
      this.googleVision.apply({ kind: 'none', fingerprint: 'none' });
    }
    return this.googleVision.isAvailable();
  }

  async processar(req: OCRRequest): Promise<OCRProcessarResponse> {
    await this.ensureGoogleVision();
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
    return this.googleVision.isAvailable() || this.integrationCreds.peekGoogleVision().configured;
  }

  async extractDocumentText(buffer: Buffer): Promise<string> {
    if (await this.ensureGoogleVision()) {
      try {
        const text = await this.googleVision.extractDocumentText(buffer);
        if (text.trim()) return text;
      } catch (err) {
        this.logger.warn(`Vision documento falhou: ${(err as Error).message}`);
      }
    }
    return '';
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    const available = await this.ensureGoogleVision();
    if (!available) {
      return { ok: false, message: 'Google Vision não configurado — cole o JSON da service account.' };
    }
    const probe = await this.googleVision.probe();
    const resolved = this.integrationCreds.peekGoogleVision();
    const hint = resolved.clientEmail ?? (resolved.apiKey ? 'API key' : undefined);
    if (!probe.ok) {
      return { ok: false, message: hint ? `${probe.message} (${hint})` : probe.message };
    }
    return {
      ok: true,
      message: hint ? `Google Vision OK (${hint})` : probe.message,
    };
  }

  private compararValores(extraido: string, esperado?: string): boolean {
    if (!esperado || !extraido) return false;
    const clean = (v: string) => v.toUpperCase().replace(/[\s\-]/g, '');
    return clean(extraido) === clean(esperado);
  }
}
