import { BadRequestException } from '@nestjs/common';
import { validateCnpjDigits, validateCpfDigits } from './br-documents';

const MSG_INVALIDO =
  'Documento inválido. Informe um CPF ou CNPJ válido.';

/** Preserva dígitos mesmo quando o JSON/body coerce o valor para número (CPF com zero à esquerda). */
export function sanitizeDocumentoInput(value: unknown): string {
  if (value == null) return '';
  return String(value).replace(/\D/g, '');
}

/**
 * Normaliza login: somente dígitos; CPF (11) validado e armazenado com 14 dígitos
 * (zeros à esquerda), alinhado a `Cliente.cpfCnpj` / cadastro fiscal.
 */
export function normalizeLoginDocumento(raw: string): string {
  const clean = sanitizeDocumentoInput(raw);
  // CPF: 10–11 dígitos (10 ocorre após coerção numérica do ValidationPipe no JSON).
  if (clean.length >= 10 && clean.length <= 11) {
    const cpf11 = clean.padStart(11, '0');
    if (!validateCpfDigits(cpf11)) {
      throw new BadRequestException(MSG_INVALIDO);
    }
    return cpf11.padStart(14, '0');
  }
  if (clean.length === 14) {
    if (!validateCnpjDigits(clean)) {
      throw new BadRequestException(MSG_INVALIDO);
    }
    return clean;
  }
  // CNPJ parcialmente truncado por coerção numérica (raro).
  if (clean.length > 11 && clean.length < 14) {
    const cnpj14 = clean.padStart(14, '0');
    if (validateCnpjDigits(cnpj14)) return cnpj14;
  }
  throw new BadRequestException(MSG_INVALIDO);
}
