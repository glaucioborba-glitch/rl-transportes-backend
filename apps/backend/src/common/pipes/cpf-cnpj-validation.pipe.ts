import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class CpfCnpjValidationPipe implements PipeTransform {
  transform(value: any) {
    if (!value?.cpfCnpj) {
      return value;
    }

    const clean = value.cpfCnpj.replace(/\D/g, '');

    if (clean.length === 11) {
      if (!this.isValidCpf(clean)) {
        throw new BadRequestException(
          'CPF inválido. Verifique os dígitos verificadores.',
        );
      }
    } else if (clean.length === 14) {
      if (!this.isValidCnpj(clean)) {
        throw new BadRequestException(
          'CNPJ inválido. Verifique os dígitos verificadores.',
        );
      }
    } else {
      throw new BadRequestException(
        'Documento deve ter 11 (CPF) ou 14 (CNPJ) dígitos.',
      );
    }

    value.cpfCnpj = clean;
    return value;
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