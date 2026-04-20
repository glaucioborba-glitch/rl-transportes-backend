import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { isValidPlacaMercosulExtended } from '../utils/mercosul';

@Injectable()
export class MercosulPlateValidationPipe implements PipeTransform {
  transform(value: any) {
    if (!value?.placa) {
      return value;
    }

    if (!isValidPlacaMercosulExtended(String(value.placa))) {
      throw new BadRequestException(
        'Placa inválida. Formato Mercosul esperado: ABCD1D34 ou ABCD-1D34',
      );
    }

    value.placa = String(value.placa).replace(/[\s-]/g, '').toUpperCase();
    return value;
  }
}
