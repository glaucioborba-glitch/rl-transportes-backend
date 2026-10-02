import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Entrada para normalização (corpo parcial ou completo). */
export class NormalizeAddressInputDto {
  @IsString()
  @Matches(/^\d{8}$/, { message: 'CEP deve ter 8 dígitos.' })
  cep!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  logradouro?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  numero?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  complemento?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bairro?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  cidade?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(2)
  uf?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{7}$/, { message: 'Código IBGE deve ter 7 dígitos.' })
  codigoIbge?: string;
}
