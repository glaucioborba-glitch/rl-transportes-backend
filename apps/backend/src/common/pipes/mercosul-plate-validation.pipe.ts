import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/** Mercosul: 4 letras + 1 dígito + 1 letra + 2 dígitos (ex.: ABCD1D34 ou ABCD-1D34). */
const MERCOSUL_NORM = /^[A-Z]{4}\d[A-Z]\d{2}$/;

@Injectable()
export class MercosulPlateValidationPipe implements PipeTransform {
  transform(value: unknown) {
    if (!value || typeof value !== 'object') {
      throw new BadRequestException(
        'Placa inválida. Formato Mercosul: ABCD-1D34 ou ABCD1D34.',
      );
    }
    const o = value as { placa?: unknown };
    if (typeof o.placa !== 'string' || !o.placa.trim()) {
      throw new BadRequestException(
        'Placa inválida. Formato Mercosul: ABCD-1D34 ou ABCD1D34.',
      );
    }
    const normalized = o.placa.replace(/\s/g, '').replace(/-/g, '').toUpperCase();
    if (!MERCOSUL_NORM.test(normalized)) {
      throw new BadRequestException(
        'Placa inválida. Formato Mercosul: ABCD-1D34 ou ABCD1D34.',
      );
    }
    o.placa = normalized;
    return value;
  }
}
