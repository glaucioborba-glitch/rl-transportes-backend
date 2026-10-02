import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { validateCpfDigits } from '../../common/utils/br-documents';

const MSG_CPF_TAMANHO = 'CPF deve conter exatamente 11 dígitos';
const MSG_CPF_INVALIDO = 'CPF inválido — dígitos verificadores não conferem';
const MSG_CNPJ_BLOQUEADO = 'Login de funcionários aceita apenas CPF (11 dígitos)';
const MSG_EMAIL_BLOQUEADO = 'Login da intranet aceita apenas CPF, não e-mail';

/**
 * Login intranet/staff: apenas CPF (11 dígitos) com dígitos verificadores válidos.
 */
@Injectable()
export class StaffLoginCpfPipe implements PipeTransform {
  transform(body: Record<string, unknown>) {
    if (body == null || typeof body !== 'object') return body;
    const raw = body['documento'] ?? body['cpf'] ?? body['cpfCnpj'];
    const rawStr = String(raw ?? '');
    if (rawStr.includes('@')) {
      throw new BadRequestException(MSG_EMAIL_BLOQUEADO);
    }
    const sanitized = rawStr.replace(/\D/g, '');
    if (sanitized.length === 14) {
      throw new BadRequestException(MSG_CNPJ_BLOQUEADO);
    }
    if (sanitized.length !== 11) {
      throw new BadRequestException(MSG_CPF_TAMANHO);
    }
    if (!validateCpfDigits(sanitized)) {
      throw new BadRequestException(MSG_CPF_INVALIDO);
    }
    body['documento'] = sanitized;
    return body;
  }
}
