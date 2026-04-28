import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

/** Intervalo de análise (datas só no formato YYYY-MM-DD, fuso do servidor). */
export class DashboardPerformanceQueryDto {
  @ApiPropertyOptional({ example: '2026-04-01' })
  @IsOptional()
  dataInicio?: string;

  @ApiPropertyOptional({ example: '2026-04-28' })
  @IsOptional()
  dataFim?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  clienteId?: string;
}
