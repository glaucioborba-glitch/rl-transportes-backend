import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsISO8601, IsOptional, IsString, IsUUID, MaxLength, MinLength, Matches } from 'class-validator';
import { normalizeCpfDigits } from '../../common/utils/data-sanitize';

export class CreatePortariaDto {
  @ApiProperty()
  @IsUUID()
  solicitacaoId!: string;

  @ApiProperty({ example: 'ABCD-1D34', description: 'Placa Mercosul (com ou sem hífen)' })
  @IsString()
  @MinLength(7)
  placa!: string;

  @ApiPropertyOptional({ description: 'Nome do motorista' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  motoristaNome?: string;

  @ApiPropertyOptional({ example: '12345678901' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? normalizeCpfDigits(value) : value))
  @Matches(/^\d{11}$/, { message: 'CPF do motorista deve conter 11 dígitos' })
  motoristaCpf?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  transportadoraNome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  motoristaTelefone?: string;

  @ApiPropertyOptional({ description: 'Evidências fotográficas (data URL ou metadados JSON)' })
  @IsOptional()
  @IsArray()
  @Type(() => String)
  fotosCaminhao?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @Type(() => String)
  fotosContainer?: string[];

  @ApiPropertyOptional({ description: 'CT-e / documento de transporte' })
  @IsOptional()
  @IsArray()
  @Type(() => String)
  fotosDocumento?: string[];

  @ApiPropertyOptional({ description: 'Instante do check-in na portaria (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  timestamp?: string;
}
