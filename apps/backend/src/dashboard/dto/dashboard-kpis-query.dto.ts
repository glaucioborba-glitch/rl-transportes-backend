import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export type DashboardKpisPeriodo = 'hoje' | 'semana' | 'mes';

export class DashboardKpisQueryDto {
  @ApiPropertyOptional({ enum: ['hoje', 'semana', 'mes'], default: 'hoje' })
  @IsOptional()
  @IsIn(['hoje', 'semana', 'mes'])
  periodo?: DashboardKpisPeriodo;
}
