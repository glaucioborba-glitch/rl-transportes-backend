import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { TipoCliente } from '@prisma/client';

function isPf(t: unknown): boolean {
  return t === TipoCliente.PF || t === 'PF';
}

function isPj(t: unknown): boolean {
  return t === TipoCliente.PJ || t === 'PJ';
}

function sanitizeDocumento(raw: unknown): string {
  return String(raw ?? '').replace(/\D/g, '');
}

@Injectable()
export class CpfCnpjValidationPipe implements PipeTransform {
  transform(value: unknown) {
    if (value == null || typeof value !== 'object') {
      return value;
    }

    const body = value as Record<string, unknown>;
    const sanitized = sanitizeDocumento(body.cpfCnpj);
    const tipo = body.tipo;

    if (isPf(tipo)) {
      if (!sanitized) {
        throw new BadRequestException(
          'CPF é obrigatório. Informe um documento de 11 dígitos.',
        );
      }
      if (sanitized.length === 14) {
        throw new BadRequestException('Para Pessoa Física, somente CPF é permitido.');
      }
      if (sanitized.length !== 11) {
        throw new BadRequestException('CPF inválido. Informe um documento de 11 dígitos.');
      }
      if (!this.isValidCpf(sanitized)) {
        throw new BadRequestException('CPF inválido. Verifique os dígitos verificadores.');
      }
      body.cpfCnpj = sanitized;
      return body;
    }

    if (isPj(tipo)) {
      if (!sanitized) {
        throw new BadRequestException(
          'CNPJ é obrigatório. Informe um documento de 14 dígitos.',
        );
      }
      if (sanitized.length !== 14) {
        throw new BadRequestException('CNPJ inválido. Informe um documento de 14 dígitos.');
      }
      if (!this.isValidCnpj(sanitized)) {
        throw new BadRequestException('CNPJ inválido. Verifique os dígitos verificadores.');
      }
      body.cpfCnpj = sanitized;
      return body;
    }

    if (!sanitized) {
      return value;
    }

    if (sanitized.length !== 11 && sanitized.length !== 14) {
      throw new BadRequestException(
        'Documento deve ter 11 (CPF) ou 14 (CNPJ) dígitos.',
      );
    }

    if (sanitized.length === 11) {
      if (!this.isValidCpf(sanitized)) {
        throw new BadRequestException(
          'CPF inválido. Verifique os dígitos verificadores.',
        );
      }
    } else if (!this.isValidCnpj(sanitized)) {
      throw new BadRequestException(
        'CNPJ inválido. Verifique os dígitos verificadores.',
      );
    }

    body.cpfCnpj = sanitized;
    return body;
  }

  private isValidCpf(cpf: string): boolean {
    if (cpf === cpf[0].repeat(11)) return false;

    const digits = cpf.split('').map(Number);

    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += digits[i] * (10 - i);
    }
    const remainder1 = sum % 11;
    const digit1 = remainder1 < 2 ? 0 : 11 - remainder1;

    if (digits[9] !== digit1) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += digits[i] * (11 - i);
    }
    const remainder2 = sum % 11;
    const digit2 = remainder2 < 2 ? 0 : 11 - remainder2;

    return digits[10] === digit2;
  }

  private isValidCnpj(cnpj: string): boolean {
    if (cnpj === cnpj[0].repeat(14)) return false;

    const digits = cnpj.split('').map(Number);

    let sum = 0;
    const multipliers1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    for (let i = 0; i < 12; i++) {
      sum += digits[i] * multipliers1[i];
    }
    const remainder1 = sum % 11;
    const digit1 = remainder1 < 2 ? 0 : 11 - remainder1;

    if (digits[12] !== digit1) return false;

    sum = 0;
    const multipliers2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    for (let i = 0; i < 13; i++) {
      sum += digits[i] * multipliers2[i];
    }
    const remainder2 = sum % 11;
    const digit2 = remainder2 < 2 ? 0 : 11 - remainder2;

    return digits[13] === digit2;
  }
}
