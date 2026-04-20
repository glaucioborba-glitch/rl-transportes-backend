import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { isValidIso6346 } from '../utils/iso6346';

@Injectable()
export class Iso6346ValidationPipe implements PipeTransform {
  transform(value: any) {
    if (!value?.numeroIso) {
      return value;
    }

    if (!isValidIso6346(String(value.numeroIso))) {
      throw new BadRequestException(
        'ISO 6346 inválido. Formato esperado: 4 letras + 6 números + 1 check digit (ex: TEMU6079348)',
      );
    }

    value.numeroIso = String(value.numeroIso).replace(/\s/g, '').toUpperCase();
    return value;
  }
}
