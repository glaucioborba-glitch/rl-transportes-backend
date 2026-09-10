import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateEmpresaOperadoraDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  razaoSocial?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  nomeFantasia?: string;

  @IsOptional()
  @IsString()
  @MaxLength(18)
  cnpj?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  inscricaoEstadual?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  inscricaoMunicipal?: string;

  @IsOptional()
  @IsString()
  @MaxLength(7)
  cnae?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  emailNf?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  emailFinanceiro?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  site?: string;

  @IsOptional()
  @IsString()
  @MaxLength(9)
  cep?: string;

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
  @MaxLength(2)
  uf?: string;

  @IsOptional()
  @IsIn(['SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL'])
  regimeTributario?: 'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL';

  @IsOptional()
  @IsString()
  @MaxLength(8)
  simplesAnexo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  aliquotaIss?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  aliquotaPis?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  aliquotaCofins?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  aliquotaCsll?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  aliquotaIrpj?: number;
}
