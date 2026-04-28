import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

/** Intervalo YYYY-MM-DD (fuso servidor). */
export class ComercialPeriodQueryDto {
  @ApiPropertyOptional({ example: '2025-05-01' })
  @IsOptional()
  dataInicio?: string;

  @ApiPropertyOptional({ example: '2026-04-30' })
  @IsOptional()
  dataFim?: string;

  @ApiPropertyOptional({ description: 'Filtra métricas já globais por cliente' })
  @IsOptional()
  @IsUUID()
  clienteId?: string;
}
