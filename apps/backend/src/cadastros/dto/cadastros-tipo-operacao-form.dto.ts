import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CadastrosTipoOperacaoFormDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  codigo!: string;

  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nome!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descricao?: string;

  @ApiPropertyOptional({ default: 'ENTRADA' })
  @IsOptional()
  @IsString()
  direcao?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  exigeContainer?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  exigeCaminhao?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  exigeEmpilhadeira?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  tempoPadrao?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  centroCustoPadrao?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(16)
  cor?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
