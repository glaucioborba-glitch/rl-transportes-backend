import type { OCRProvider, OCRRequest, OCRResult } from '../ocr-provider.interface';
import { parseContainerNumber, parsePlaca } from '../utils/ocr-parsers';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Tesseract = require('tesseract.js') as typeof import('tesseract.js');

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export class TesseractProvider implements OCRProvider {
  name = 'tesseract' as const;

  async processar(req: OCRRequest): Promise<OCRResult> {
    try {
      const imagem = req.imagem.startsWith('data:')
        ? req.imagem
        : `data:image/jpeg;base64,${req.imagem}`;

      const { data } = await Tesseract.recognize(imagem, 'eng', {
        logger: () => {},
      });

      const textoBruto = data.text ?? '';
      let textoExtraido = '';
      let confianca = 0;
      const tesseractScore = Math.min(1, Math.max(0, (data.confidence ?? 0) / 100));

      if (req.tipo === 'CONTAINER') {
        const parsed = parseContainerNumber(textoBruto);
        textoExtraido = parsed.numero;
        confianca = parsed.confianca * tesseractScore;
      } else {
        const parsed = parsePlaca(textoBruto);
        textoExtraido = parsed.placa;
        confianca = parsed.confianca * tesseractScore;
      }

      return {
        textoBruto,
        textoExtraido,
        confianca,
        provider: 'tesseract',
        sucesso: textoExtraido.length > 0,
      };
    } catch (err) {
      return {
        textoBruto: '',
        textoExtraido: '',
        confianca: 0,
        provider: 'tesseract',
        sucesso: false,
        erro: errorMessage(err),
      };
    }
  }
}
