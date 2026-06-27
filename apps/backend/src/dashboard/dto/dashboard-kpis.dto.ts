import { ApiProperty } from '@nestjs/swagger';

export class DashboardTatHistoryPointDto {
  @ApiProperty({ example: '08h' })
  hour!: string;

  @ApiProperty({ example: 42.5, description: 'TAT médio na hora (minutos)' })
  tat!: number;
}

export class DashboardKpiDeltaDto {
  @ApiProperty({ example: -5.2, description: 'Variação percentual vs período anterior' })
  pct!: number;

  @ApiProperty({ enum: ['up', 'down', 'flat'] })
  direction!: 'up' | 'down' | 'flat';
}

export class DashboardFinanceBarPointDto {
  @ApiProperty({ example: '2026-06-10' })
  label!: string;

  @ApiProperty()
  receita!: number;

  @ApiProperty()
  custoFrota!: number;
}

export class DashboardYardTypeSliceDto {
  @ApiProperty({ example: 'CHEIO' })
  tipo!: string;

  @ApiProperty()
  quantidade!: number;

  @ApiProperty()
  pct!: number;
}

export class DashboardKpisDto {
  @ApiProperty({ enum: ['hoje', 'semana', 'mes'] })
  periodo!: string;

  @ApiProperty({ description: 'Turnaround Time médio (minutos) — gate-in a gate-out' })
  tat!: number;

  @ApiProperty({ description: 'Ocupação do pátio v2 (%)' })
  yardOccupancy!: number;

  @ApiProperty({ description: 'Eficiência da frota própria (% motoristas em viagem)' })
  fleetEfficiency!: number;

  @ApiProperty({ description: 'Receita média por TEU movimentado no período (R$)' })
  revenuePerTeu!: number;

  @ApiProperty({ description: 'Faturamento consolidado no período (R$)' })
  dailyRevenue!: number;

  @ApiProperty({ type: DashboardKpiDeltaDto })
  tatDelta!: DashboardKpiDeltaDto;

  @ApiProperty({ type: DashboardKpiDeltaDto })
  yardDelta!: DashboardKpiDeltaDto;

  @ApiProperty({ type: DashboardKpiDeltaDto })
  fleetDelta!: DashboardKpiDeltaDto;

  @ApiProperty({ type: DashboardKpiDeltaDto })
  revenueDelta!: DashboardKpiDeltaDto;

  @ApiProperty({ type: [DashboardTatHistoryPointDto] })
  tatHistory!: DashboardTatHistoryPointDto[];

  @ApiProperty({ type: [DashboardFinanceBarPointDto] })
  revenueVsFleetCost!: DashboardFinanceBarPointDto[];

  @ApiProperty({ type: [DashboardYardTypeSliceDto] })
  yardByContainerType!: DashboardYardTypeSliceDto[];

  @ApiProperty()
  geradoEm!: string;
}
