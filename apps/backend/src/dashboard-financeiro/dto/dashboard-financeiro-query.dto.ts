import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, Matches } from 'class-validator';

/** Competência no formato YYYY-MM + filtro opcional por cliente. */
export class DashboardFinanceiroQueryDto {
  @ApiPropertyOptional({
    example: '2026-01',
    description: 'Início do intervalo de competências (inclusive)',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/, { message: 'periodoInicio deve ser YYYY-MM' })
  periodoInicio?: string;

  @ApiPropertyOptional({
    example: '2026-04',
    description: 'Fim do intervalo de competências (inclusive)',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/, { message: 'periodoFim deve ser YYYY-MM' })
  periodoFim?: string;

  @ApiPropertyOptional({ description: 'Restringe métricas a um cliente' })
  @IsOptional()
  @IsUUID()
  clienteId?: string;
}
