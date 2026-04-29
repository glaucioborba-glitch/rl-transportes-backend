import { ApiPropertyOptional } from '@nestjs/swagger';
import { StatusSolicitacao } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

/** Filtros opcionais do painel operacional (snapshot, SLA e filas). */
export class DashboardQueryDto {
  @ApiPropertyOptional({ description: 'Filtra métricas pela solicitação deste cliente' })
  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @ApiPropertyOptional({ example: '2026-04-01', description: 'Início do período (YYYY-MM-DD) para SLA e rankings' })
  @IsOptional()
  dataInicio?: string;

  @ApiPropertyOptional({ example: '2026-04-28', description: 'Fim do período (YYYY-MM-DD) para SLA e rankings' })
  @IsOptional()
  dataFim?: string;

  @ApiPropertyOptional({ enum: StatusSolicitacao })
  @IsOptional()
  @IsEnum(StatusSolicitacao)
  status?: StatusSolicitacao;
}
