import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { validateCnpjDigits, validateCpfDigits } from '../../common/utils/br-documents';

const MSG_INVALIDO = 'CPF/CNPJ inválido';
const MSG_TAMANHO = 'Documento deve ter 11 (CPF) ou 14 (CNPJ) dígitos';

/**
 * Login corporativo (intranet / staff): CPF/CNPJ com dígitos verificadores (módulo 11).
 * Aceita `documento` ou `cpfCnpj` no body. Retorna somente dígitos.
 */
@Injectable()
export class CorporateCpfCnpjPipe implements PipeTransform {
  transform(body: Record<string, unknown>) {
    if (body == null || typeof body !== 'object') return body;
    const raw = body['documento'] ?? body['cpfCnpj'];
    const sanitized = String(raw ?? '').replace(/\D/g, '');
    if (!sanitized || (sanitized.length !== 11 && sanitized.length !== 14)) {
      throw new BadRequestException(MSG_TAMANHO);
    }
    if (sanitized.length === 11) {
      if (!validateCpfDigits(sanitized)) {
        throw new BadRequestException(MSG_INVALIDO);
      }
    } else if (!validateCnpjDigits(sanitized)) {
      throw new BadRequestException(MSG_INVALIDO);
    }
    body['documento'] = sanitized;
    return body;
  }
}

/** Alias do pipe corporativo (path legado da spec). */
export { CorporateCpfCnpjPipe as CpfCnpjPipe };
