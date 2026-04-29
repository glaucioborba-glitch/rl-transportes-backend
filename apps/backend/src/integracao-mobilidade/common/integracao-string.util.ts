/** Normalização simples de placas / ISO para comparadores (Fase 14 — preparação OCR). */
export function normalizarIdentificadorVeicular(valor: string): string {
  return valor.replace(/\s+/g, '').replace(/-/g, '').toUpperCase();
}

/** Metadado para payloads grande base64 (compressão recomendada no app). */
export function digestBase64Payload(base64?: string): {
  lengthChars: number;
  hint: string;
} {
  const lengthChars = base64?.length ?? 0;
  return {
    lengthChars,
    hint:
      lengthChars > 20_000
        ? 'Preferir gzip/base64 no cliente ou chunking; payload truncado nos logs.'
        : 'ok',
  };
}
