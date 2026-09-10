import { ImageAnnotatorClient } from '@google-cloud/vision';
import type { OCRProvider, OCRRequest, OCRResult } from '../ocr-provider.interface';
import { parseContainerNumber, parsePlaca } from '../utils/ocr-parsers';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

type VisionApply =
  | { kind: 'json'; credentials: Record<string, unknown>; fingerprint: string }
  | { kind: 'adc'; fingerprint: 'adc' }
  | { kind: 'apiKey'; apiKey: string; fingerprint: string }
  | { kind: 'none'; fingerprint: 'none' };

const TINY_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';

type VisionAnnotateResponse = {
  fullText?: string;
  text?: string;
};

async function annotateWithApiKey(
  apiKey: string,
  base64: string,
  feature: 'TEXT_DETECTION' | 'DOCUMENT_TEXT_DETECTION',
): Promise<VisionAnnotateResponse> {
  const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      requests: [{ image: { content: base64 }, features: [{ type: feature }] }],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const body = (await res.json()) as {
    error?: { message?: string };
    responses?: {
      error?: { message?: string };
      fullTextAnnotation?: { text?: string };
      textAnnotations?: { description?: string }[];
    }[];
  };
  if (!res.ok) throw new Error(body.error?.message ?? `Vision HTTP ${res.status}`);
  const first = body.responses?.[0];
  if (first?.error?.message) throw new Error(first.error.message);
  return {
    fullText: first?.fullTextAnnotation?.text?.trim(),
    text: first?.textAnnotations?.[0]?.description?.trim(),
  };
}

export class GoogleVisionProvider implements OCRProvider {
  name = 'google_vision' as const;
  private client: ImageAnnotatorClient | null = null;
  private apiKey: string | null = null;
  private configured = false;
  private fingerprint = 'none';

  constructor() {
    const jsonCreds = process.env.GOOGLE_CREDENTIALS_JSON?.trim();
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
    const apiKey = process.env.GOOGLE_VISION_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
    if (jsonCreds) {
      try {
        this.apply({
          kind: 'json',
          credentials: JSON.parse(jsonCreds) as Record<string, unknown>,
          fingerprint: `json:${jsonCreds.slice(0, 80)}`,
        });
      } catch (err) {
        console.warn('[OCR] Google Vision não inicializado:', errorMessage(err));
        this.apply({ kind: 'none', fingerprint: 'none' });
      }
    } else if (credPath) {
      this.apply({ kind: 'adc', fingerprint: 'adc' });
    } else if (apiKey) {
      this.apply({ kind: 'apiKey', apiKey, fingerprint: `key:${apiKey.slice(0, 8)}` });
    }
  }

  apply(next: VisionApply): void {
    if (
      next.fingerprint === this.fingerprint &&
      (next.kind === 'none' || this.client || this.apiKey)
    ) {
      return;
    }
    this.fingerprint = next.fingerprint;
    this.client = null;
    this.apiKey = null;
    this.configured = false;
    if (next.kind === 'none') return;
    if (next.kind === 'apiKey') {
      this.apiKey = next.apiKey;
      this.configured = true;
      return;
    }
    try {
      this.client =
        next.kind === 'json'
          ? new ImageAnnotatorClient({ credentials: next.credentials })
          : new ImageAnnotatorClient();
      this.configured = true;
    } catch (err) {
      console.warn('[OCR] Google Vision não inicializado:', errorMessage(err));
      this.client = null;
      this.configured = false;
    }
  }

  isAvailable(): boolean {
    return this.configured && (this.client !== null || Boolean(this.apiKey));
  }

  async probe(): Promise<{ ok: boolean; message: string }> {
    if (!this.isAvailable()) {
      return { ok: false, message: 'Cliente Google Vision não inicializado' };
    }
    try {
      if (this.apiKey) {
        await annotateWithApiKey(this.apiKey, TINY_PNG, 'DOCUMENT_TEXT_DETECTION');
      } else {
        await this.client!.documentTextDetection({
          image: { content: Buffer.from(TINY_PNG, 'base64') },
        });
      }
      return { ok: true, message: 'Google Vision respondeu' };
    } catch (err) {
      return { ok: false, message: errorMessage(err) };
    }
  }

  async extractDocumentText(buffer: Buffer): Promise<string> {
    if (!this.isAvailable()) return '';
    const base64 = buffer.toString('base64');
    if (this.apiKey) {
      const r = await annotateWithApiKey(this.apiKey, base64, 'DOCUMENT_TEXT_DETECTION');
      return r.fullText || r.text || '';
    }
    const [result] = await this.client!.documentTextDetection({
      image: { content: base64 },
    });
    return (
      result.fullTextAnnotation?.text?.trim() ||
      result.textAnnotations?.[0]?.description?.trim() ||
      ''
    );
  }

  async processar(req: OCRRequest): Promise<OCRResult> {
    if (!this.isAvailable()) {
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
      let textoBruto = '';
      if (this.apiKey) {
        const r = await annotateWithApiKey(this.apiKey, base64, 'TEXT_DETECTION');
        textoBruto = r.text || r.fullText || '';
      } else {
        const [result] = await this.client!.textDetection({
          image: { content: base64 },
        });
        textoBruto = result.textAnnotations?.[0]?.description ?? '';
      }
      if (!textoBruto) {
        return {
          textoBruto: '',
          textoExtraido: '',
          confianca: 0,
          provider: 'google_vision',
          sucesso: false,
          erro: 'Nenhum texto encontrado na imagem',
        };
      }
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
