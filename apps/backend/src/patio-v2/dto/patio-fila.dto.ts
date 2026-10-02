import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class EnfileirarPatioDto {
  @ApiProperty({ example: 'RL-2026-0001' })
  @IsString()
  @MaxLength(32)
  protocolo!: string;

  @ApiProperty({ enum: ['PRIORITARIO', 'PREFERENCIAL', 'NORMAL'] })
  @IsIn(['PRIORITARIO', 'PREFERENCIAL', 'NORMAL'])
  urgencia!: 'PRIORITARIO' | 'PREFERENCIAL' | 'NORMAL';
}

export class RemocaoPatioFilaDto {
  @ApiProperty({ example: 'A1-1' })
  @IsString()
  @MaxLength(64)
  origemCodigo!: string;

  @ApiProperty({ example: 'A1-4' })
  @IsString()
  @MaxLength(64)
  destinoCodigo!: string;
}

export class ConfirmarPatioFilaDto {
  @ApiPropertyOptional({ example: 'A-01', description: 'Posição de destino (baixa) ou de coleta.' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  posicaoCodigo?: string;
}
