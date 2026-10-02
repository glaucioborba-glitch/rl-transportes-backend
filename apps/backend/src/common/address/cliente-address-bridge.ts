import type { Cliente } from '@prisma/client';
import type { CreateClienteDto } from '../../clientes/dto/create-cliente.dto';
import type { UpdateClienteDto } from '../../clientes/dto/update-cliente.dto';
import type { NormalizedPostalAddress, PostalAddressInput } from './address.service';

export function postalInputFromCreateDto(dto: CreateClienteDto): PostalAddressInput {
  return {
    cep: dto.enderecoCep,
    logradouro: dto.enderecoLogradouro,
    numero: dto.enderecoNumero,
    complemento: dto.enderecoComplemento,
    bairro: dto.enderecoBairro,
    cidade: dto.enderecoCidade,
    uf: dto.enderecoUf,
    codigoIbge: dto.codigoMunicipioIbge,
  };
}

export function mergePostalForUpdate(antes: Cliente, dto: UpdateClienteDto): PostalAddressInput {
  return {
    cep: (dto.enderecoCep ?? antes.enderecoCep).replace(/\D/g, ''),
    logradouro: dto.enderecoLogradouro ?? antes.enderecoLogradouro,
    numero: dto.enderecoNumero ?? antes.enderecoNumero,
    complemento: dto.enderecoComplemento ?? antes.enderecoComplemento ?? undefined,
    bairro: dto.enderecoBairro ?? antes.enderecoBairro,
    cidade: dto.enderecoCidade ?? antes.enderecoCidade,
    uf: dto.enderecoUf ?? antes.enderecoUf,
    codigoIbge: dto.codigoMunicipioIbge ?? antes.codigoMunicipioIbge ?? undefined,
  };
}

export function applyNormalizedToCreateDto(dto: CreateClienteDto, n: NormalizedPostalAddress): void {
  dto.enderecoCep = n.cep;
  dto.enderecoLogradouro = n.logradouro;
  dto.enderecoNumero = n.numero;
  dto.enderecoComplemento = n.complemento ?? undefined;
  dto.enderecoBairro = n.bairro;
  dto.enderecoCidade = n.cidade;
  dto.enderecoUf = n.uf;
  dto.codigoMunicipioIbge = n.codigoIbge;
}

export function normalizedToClienteUpdateData(
  n: NormalizedPostalAddress,
): Pick<
  Cliente,
  | 'enderecoCep'
  | 'enderecoLogradouro'
  | 'enderecoNumero'
  | 'enderecoComplemento'
  | 'enderecoBairro'
  | 'enderecoCidade'
  | 'enderecoUf'
  | 'codigoMunicipioIbge'
> {
  return {
    enderecoCep: n.cep,
    enderecoLogradouro: n.logradouro,
    enderecoNumero: n.numero,
    enderecoComplemento: n.complemento,
    enderecoBairro: n.bairro,
    enderecoCidade: n.cidade,
    enderecoUf: n.uf,
    codigoMunicipioIbge: n.codigoIbge,
  };
}
