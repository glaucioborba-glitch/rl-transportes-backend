import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CadastrosMotoristaFormDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  nome!: string;

  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\D/g, '') : value))
  @IsString()
  @Matches(/^\d{11}$/, { message: 'CPF deve ter 11 dígitos.' })
  cpf!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rg?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dataNascimento?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  celular?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  telefone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cep?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endereco?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  numero?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  complemento?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bairro?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cidade?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  uf?: string;

  @ApiProperty()
  @IsUUID()
  transportadoraId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  cnhNumero!: string;

  @ApiProperty()
  @IsIn(['A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE'])
  cnhCategoria!: string;

  @ApiProperty()
  @IsDateString()
  cnhValidade!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2)
  cnhUfEmissao?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observacoes?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
