import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { isValidIso6346 } from '../utils/iso6346';

@Injectable()
export class Iso6346ValidationPipe implements PipeTransform {
  transform(value: unknown) {
    if (!value || typeof value !== 'object') {
      throw new BadRequestException(
        'ISO 6346 inválido. Formato esperado: 4 letras + 6 números + 1 check digit.',
      );
    }
    const o = value as { numeroIso?: unknown };
    if (typeof o.numeroIso !== 'string') {
      throw new BadRequestException(
        'ISO 6346 inválido. Formato esperado: 4 letras + 6 números + 1 check digit.',
      );
    }
    const code = o.numeroIso.replace(/\s/g, '').toUpperCase();
    if (!isValidIso6346(code)) {
      throw new BadRequestException(
        'ISO 6346 inválido. Formato esperado: 4 letras + 6 números + 1 check digit.',
      );
    }
    o.numeroIso = code;
    return value;
  }
}
