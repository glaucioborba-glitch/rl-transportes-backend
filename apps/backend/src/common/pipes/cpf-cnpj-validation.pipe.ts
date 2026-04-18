import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import {
  onlyDigits,
  validateCnpjDigits,
  validateCpfDigits,
} from '../utils/br-documents';

@Injectable()
export class CpfCnpjValidationPipe implements PipeTransform {
  transform(value: unknown) {
    if (!value || typeof value !== 'object') {
      throw new BadRequestException(
        'Documento deve ter 11 (CPF) ou 14 (CNPJ) dígitos.',
      );
    }
    const o = value as { cpfCnpj?: unknown };
    if (typeof o.cpfCnpj !== 'string') {
      throw new BadRequestException(
        'Documento deve ter 11 (CPF) ou 14 (CNPJ) dígitos.',
      );
    }
    const digits = onlyDigits(o.cpfCnpj);
    if (digits.length === 11) {
      if (!validateCpfDigits(digits)) {
        throw new BadRequestException('CPF inválido (validação modular).');
      }
    } else if (digits.length === 14) {
      if (!validateCnpjDigits(digits)) {
        throw new BadRequestException('CNPJ inválido (validação modular).');
      }
    } else {
      throw new BadRequestException(
        'Documento deve ter 11 (CPF) ou 14 (CNPJ) dígitos.',
      );
    }
    o.cpfCnpj = digits;
    return value;
  }
}
