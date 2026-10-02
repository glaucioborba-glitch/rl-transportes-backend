import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CadastrosCentroCustoFormDto {
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

  @ApiPropertyOptional({ default: 'ANALITICO' })
  @IsOptional()
  @IsString()
  tipo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paiId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descricao?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
