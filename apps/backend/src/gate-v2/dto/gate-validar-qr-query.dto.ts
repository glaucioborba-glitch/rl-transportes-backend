import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class GateValidarQrQueryDto {
  @ApiPropertyOptional({ example: 'RL-2026-A1B2C3D4', description: 'Obrigatório se payload não for informado' })
  @IsOptional()
  @IsString()
  @MinLength(5)
  protocolo?: string;

  @ApiPropertyOptional({ description: 'ISO canônico ou mascarado do QR' })
  @IsOptional()
  @IsString()
  container?: string;

  @ApiPropertyOptional({ description: 'Token unificado do QR (campo token do JSON)' })
  @IsOptional()
  @IsString()
  token?: string;

  @ApiPropertyOptional({ description: 'Versão da credencial (legado; ignorado na validação unificada)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  versao?: number;

  @ApiPropertyOptional({
    description: 'JSON bruto lido pelo scanner (alternativa a protocolo/container/versao)',
  })
  @IsOptional()
  @IsString()
  payload?: string;
}
