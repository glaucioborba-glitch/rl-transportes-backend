import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { isValidIso6346 } from '../common/utils/iso6346';
import { stripContainerIsoCanonical } from '../common/utils/data-sanitize';

/** Normaliza `:iso` da rota para 11 caracteres ISO 6346 canônicos. */
@Injectable()
export class Iso6346ParamPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    const canonical = stripContainerIsoCanonical(String(value ?? ''));
    if (canonical.length !== 11) {
      throw new BadRequestException(
        'ISO inválido. Informe 4 letras + 7 dígitos (ex.: GLDU9443335 ou GLDU 944333-5).',
      );
    }
    if (!isValidIso6346(canonical)) {
      throw new BadRequestException('Dígito verificador ISO 6346 inválido.');
    }
    return canonical;
  }
}
