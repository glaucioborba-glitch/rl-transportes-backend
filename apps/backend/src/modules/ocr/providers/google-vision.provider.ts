import { ImageAnnotatorClient } from '@google-cloud/vision';
import type { OCRProvider, OCRRequest, OCRResult } from '../ocr-provider.interface';
import { parseContainerNumber, parsePlaca } from '../utils/ocr-parsers';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export class GoogleVisionProvider implements OCRProvider {
  name = 'google_vision' as const;
  private client: ImageAnnotatorClient | null = null;
  private configured = false;

  constructor() {
    try {
      const jsonCreds = process.env.GOOGLE_CREDENTIALS_JSON?.trim();
      const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();

      if (jsonCreds) {
        this.client = new ImageAnnotatorClient({
          credentials: JSON.parse(jsonCreds) as Record<string, unknown>,
        });
        this.configured = true;
      } else if (credPath) {
        this.client = new ImageAnnotatorClient();
        this.configured = true;
      }
    } catch (err) {
      console.warn('[OCR] Google Vision não inicializado:', errorMessage(err));
      this.client = null;
      this.configured = false;
    }
  }

  isAvailable(): boolean {
    return this.configured && this.client !== null;
  }

  async processar(req: OCRRequest): Promise<OCRResult> {
    if (!this.client) {
      return {
        textoBruto: '',
        textoExtraido: '',
        confianca: 0,
        provider: 'google_vision',
        sucesso: false,
        erro: 'Cliente Google Vision não inicializado',
      };
    }

    try {
      const base64 = req.imagem.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');

      const [result] = await this.client.textDetection({
        image: { content: base64 },
      });

      const annotations = result.textAnnotations;
      if (!annotations || annotations.length === 0) {
        return {
          textoBruto: '',
          textoExtraido: '',
          confianca: 0,
          provider: 'google_vision',
          sucesso: false,
          erro: 'Nenhum texto encontrado na imagem',
        };
      }

      const textoBruto = annotations[0].description ?? '';
      let textoExtraido = '';
      let confianca = 0;

      if (req.tipo === 'CONTAINER') {
        const parsed = parseContainerNumber(textoBruto);
        textoExtraido = parsed.numero;
        confianca = parsed.confianca;
      } else {
        const parsed = parsePlaca(textoBruto);
        textoExtraido = parsed.placa;
        confianca = parsed.confianca;
      }

      return {
        textoBruto,
        textoExtraido,
        confianca,
        provider: 'google_vision',
        sucesso: textoExtraido.length > 0,
      };
    } catch (err) {
      return {
        textoBruto: '',
        textoExtraido: '',
        confianca: 0,
        provider: 'google_vision',
        sucesso: false,
        erro: errorMessage(err),
      };
    }
  }
}
