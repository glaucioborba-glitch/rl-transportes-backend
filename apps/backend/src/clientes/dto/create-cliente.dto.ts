import {
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  MaxLength,
  MinLength,
  Matches,
  IsBoolean,
  ValidateIf,
  IsNotEmpty,
  IsDateString,
  Validate,
  IsInt,
  Min,
  Max,
  IsNumber,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TipoCliente } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsCpfDigitsConstraint } from '../../common/validators/is-cpf-digits.validator';

const BR_UFS =
  /^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/;

const isPj = (o: CreateClienteDto) => o.tipo === TipoCliente.PJ;
const isPf = (o: CreateClienteDto) => o.tipo === TipoCliente.PF;

export class CreateClienteDto {
  @ApiProperty({ required: false, description: 'Obrigatório quando tipo = PF (nome completo).' })
  @ValidateIf(isPf)
  @IsNotEmpty({ message: 'Nome completo é obrigatório.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(255)
  @MinLength(3)
  nomeCompleto?: string;

  @ApiProperty({ required: false, description: 'Obrigatório quando tipo = PJ' })
  @ValidateIf(isPj)
  @IsNotEmpty({ message: 'Razão social é obrigatória.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(255)
  @MinLength(3)
  razaoSocial?: string;

  @ApiProperty({ enum: TipoCliente })
  @IsEnum(TipoCliente)
  tipo!: TipoCliente;

  @ApiProperty({ description: 'CPF ou CNPJ (normalizado no pipe)' })
  @IsString()
  @MinLength(8)
  @MaxLength(18)
  @ValidateIf(isPf)
  @Validate(IsCpfDigitsConstraint, { message: 'CPF inválido. Verifique os dígitos.' })
  cpfCnpj!: string;

  @ApiProperty({ required: false, description: 'Opcional para PF (provedores NFS-e)' })
  @IsOptional()
  @ValidateIf(
    (o: CreateClienteDto) =>
      isPf(o) && o.dataNascimento != null && String(o.dataNascimento).trim() !== '',
  )
  @IsDateString({}, { message: 'Data de nascimento inválida (use AAAA-MM-DD).' })
  dataNascimento?: string;

  @ApiProperty({ required: false, description: 'Somente PJ' })
  @ValidateIf(isPj)
  @IsNotEmpty({ message: 'Nome fantasia é obrigatório para pessoa jurídica.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(255)
  nomeFantasia?: string;

  @ApiProperty({ required: false, description: 'Somente PJ' })
  @ValidateIf(isPj)
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\D/g, '') : value))
  @IsString()
  @MaxLength(32)
  inscricaoMunicipal?: string;

  @ApiProperty({ required: false, description: 'Somente PJ' })
  @ValidateIf(isPj)
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\D/g, '') : value))
  @IsString()
  @MaxLength(32)
  inscricaoEstadual?: string;

  @ApiProperty({ required: false, default: false, description: 'Somente PJ' })
  @ValidateIf(isPj)
  @IsBoolean()
  isentoIE?: boolean;

  @ApiProperty({ description: 'E-mail de login' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    required: false,
    description: 'PJ: obrigatório. PF: opcional (default = e-mail de login no servidor).',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @ValidateIf((o: CreateClienteDto) => o.tipo === TipoCliente.PJ)
  @IsNotEmpty({ message: 'E-mail NFS-e é obrigatório para pessoa jurídica.' })
  @ValidateIf(
    (o: CreateClienteDto) =>
      o.tipo === TipoCliente.PJ ||
      (o.tipo === TipoCliente.PF &&
        o.emailNfse != null &&
        String(o.emailNfse).trim() !== ''),
  )
  @IsEmail()
  emailNfse?: string;

  @ApiProperty({ description: 'Telefone principal (DDD + número)' })
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\D/g, '') : value))
  @IsString()
  @Matches(/^\d{10,11}$/, { message: 'Telefone inválido (informe DDD + número, 10 ou 11 dígitos).' })
  telefone!: string;

  @ApiProperty({
    required: false,
    description: 'PF: telefone de contato NFS-e (usa o telefone principal se omitido).',
  })
  @ValidateIf(isPf)
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\D/g, '') : value))
  @IsString()
  @Matches(/^\d{10,11}$/, { message: 'Telefone de contato inválido.' })
  telefoneContato?: string;

  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(255)
  @MinLength(2)
  enderecoLogradouro!: string;

  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(20)
  enderecoNumero!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  enderecoComplemento?: string;

  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  @MinLength(2)
  enderecoBairro!: string;

  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  @MinLength(2)
  enderecoCidade!: string;

  @ApiProperty({ example: 'SC' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @Matches(BR_UFS, { message: 'UF inválida.' })
  enderecoUf!: string;

  @ApiProperty({ description: 'CEP (8 dígitos)' })
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\D/g, '') : value))
  @IsString()
  @Matches(/^\d{8}$/, { message: 'CEP deve ter 8 dígitos.' })
  enderecoCep!: string;

  @ApiProperty({
    required: false,
    description:
      'Código IBGE do município (7 dígitos). Opcional quando cidade/UF permitem resolução automática.',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() !== '' ? value.replace(/\D/g, '') : undefined,
  )
  @ValidateIf(
    (o: CreateClienteDto) =>
      o.codigoMunicipioIbge != null && String(o.codigoMunicipioIbge).trim() !== '',
  )
  @IsString()
  @Matches(/^\d{7}$/, { message: 'Código do município IBGE deve ter 7 dígitos.' })
  codigoMunicipioIbge?: string;

  @ApiProperty({ required: false, description: 'Obrigatório para PJ' })
  @ValidateIf(isPj)
  @IsNotEmpty({ message: 'Nome do responsável é obrigatório para pessoa jurídica.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(255)
  @MinLength(2)
  responsavel?: string;

  @ApiProperty({ required: false, description: 'Obrigatório para PJ' })
  @ValidateIf(isPj)
  @IsNotEmpty({ message: 'Telefone do responsável é obrigatório para pessoa jurídica.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\D/g, '') : value))
  @IsString()
  @Matches(/^\d{10,11}$/, { message: 'Telefone do responsável inválido.' })
  responsavelTelefone?: string;

  @ApiProperty({ required: false, description: 'Obrigatório para PJ' })
  @ValidateIf(isPj)
  @IsNotEmpty({ message: 'E-mail do responsável é obrigatório para pessoa jurídica.' })
  @IsEmail()
  responsavelEmail?: string;

  @ApiProperty({
    required: false,
    description: 'Dias após vencimento para bloqueio financeiro (fallback: TenantConfig).',
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? null : Number(value),
  )
  @ValidateIf((o: CreateClienteDto) => o.diasToleranciaBloqueio != null)
  @IsInt()
  @Min(0)
  @Max(365)
  diasToleranciaBloqueio?: number | null;

  @ApiProperty({
    required: false,
    description: 'Multa por atraso (%), ex.: 2.00. Fallback: TenantConfig.',
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? null : Number(value),
  )
  @ValidateIf((o: CreateClienteDto) => o.percentualMultaAtraso != null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  percentualMultaAtraso?: number | null;

  @ApiProperty({
    required: false,
    description: 'Juros ao mês (% a.m.), ex.: 1.00. Fallback: TenantConfig.',
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? null : Number(value),
  )
  @ValidateIf((o: CreateClienteDto) => o.percentualJurosAoMes != null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  percentualJurosAoMes?: number | null;
}
