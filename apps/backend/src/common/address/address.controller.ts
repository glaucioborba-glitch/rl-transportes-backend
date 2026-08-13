import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { onlyDigits } from './address-normalizer';
import { AddressService } from './address.service';
import { AddressInvalidException } from './exceptions/address-invalid.exception';

@ApiTags('address')
@Controller('address')
export class AddressController {
  constructor(private readonly address: AddressService) {}

  @Get('cep/:cep')
  @ApiOperation({ summary: 'Consulta CEP (cache Redis + ViaCEP + IBGE)' })
  async cep(@Param('cep') cep: string) {
    const digits = onlyDigits(cep);
    if (digits.length !== 8) {
      throw new AddressInvalidException('CEP deve ter 8 dígitos.');
    }

    const r = await this.address.lookupCepAutofill(digits);
    return {
      ok: r.cepValido,
      cepValido: r.cepValido,
      logradouro: r.logradouro ?? '',
      bairro: r.bairro ?? '',
      cidade: r.cidade ?? '',
      uf: r.uf ?? '',
      ibge: r.ibge,
      cep: r.cep,
      aviso: r.aviso ?? null,
    };
  }
}
