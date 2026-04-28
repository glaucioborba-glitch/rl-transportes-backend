import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DashboardPerformanceMargemClienteItemDto {
  @ApiProperty()
  clienteId!: string;

  @ApiProperty()
  clienteNome!: string;

  @ApiProperty({ description: 'Soma faturamentos no recorte analisado' })
  receitaPeriodo!: number;

  @ApiProperty()
  unidadesConcluidas!: number;

  @ApiProperty()
  proxyMargemPorUnidade!: number | null;
}

export class DashboardPerformanceOpDto {
  @ApiProperty()
  usuarioId!: string;

  @ApiPropertyOptional()
  email?: string | null;

  @ApiProperty()
  operacoes24h!: number;

  @ApiProperty({ description: 'Proporção de UPDATE sobre total de eventos do usuário no período' })
  proporcaoUpdates!: number | null;
}

export class DashboardPerformanceTurnoDto {
  @ApiProperty()
  manha!: number;

  @ApiProperty()
  tarde!: number;

  @ApiProperty()
  noite!: number;
}

export class DashboardPerformanceHeatDto {
  @ApiProperty({ minimum: 0, maximum: 23 })
  hora!: number;

  @ApiProperty()
  total!: number;
}

export class DashboardPerformanceMargemTipoDto {
  @ApiProperty()
  tipo!: string;

  @ApiProperty()
  unidades!: number;

  @ApiProperty()
  proxyMargemUnitaria!: number | null;
}

export class DashboardPerformanceSerieClienteMesDto {
  @ApiProperty()
  clienteId!: string;

  @ApiProperty()
  clienteNome!: string;

  @ApiProperty()
  mes!: string;

  @ApiProperty()
  valorFaturado!: number;
}

export class DashboardPerformanceMargemCustoDto {
  @ApiProperty()
  proxyMargem!: number | null;

  @ApiProperty()
  custoOperacionalEstimado!: number | null;

  @ApiProperty({ type: [DashboardPerformanceMargemTipoDto] })
  margemPorTipo!: DashboardPerformanceMargemTipoDto[];

  @ApiPropertyOptional({ type: [DashboardPerformanceSerieClienteMesDto] })
  margemPorClienteSerie6Meses!: DashboardPerformanceSerieClienteMesDto[] | null;
}

export class DashboardPerformanceEstrategicosDto {
  @ApiProperty({
    description: 'Proxy: média tempo ciclo (h) × coeficiente — custo operacional médio por operação completa',
  })
  custoMedioPorOperacao!: number | null;

  @ApiPropertyOptional({ type: [DashboardPerformanceMargemClienteItemDto] })
  margemOperacionalPorCliente!: DashboardPerformanceMargemClienteItemDto[] | null;

  @ApiProperty({ description: 'Estimativa unidades/hora na portaria no período' })
  throughputPortaria!: number | null;

  @ApiProperty()
  throughputGate!: number | null;

  @ApiProperty()
  throughputPatio!: number | null;

  @ApiProperty({ description: 'Média horas entre primeira portaria e saída quando fluxo completo' })
  tempoMedioDeCicloCompletoHoras!: number | null;

  @ApiProperty({
    description: 'Ocupação estimada vs PERFORMANCE_PATIO_CAPACIDADE_ESTIMADA',
  })
  ocupacaoPatioPercent!: number | null;

  @ApiProperty({ description: 'Updates / (inserts+updates) em portarias/gates/patios' })
  taxaRetrabalho!: number | null;

  @ApiProperty({ description: 'Fila portaria > limite configurável' })
  taxaGargaloDetectado!: boolean;
}

export class DashboardPerformanceProdHumanaDto {
  @ApiProperty({ type: [DashboardPerformanceOpDto] })
  produtividadePorOperador!: DashboardPerformanceOpDto[];

  @ApiProperty({ type: DashboardPerformanceTurnoDto })
  produtividadePorTurno!: DashboardPerformanceTurnoDto;

  @ApiProperty({ type: [DashboardPerformanceHeatDto] })
  mapaCalorPorHora!: DashboardPerformanceHeatDto[];
}

export class DashboardPerformanceGargalosDto {
  @ApiProperty()
  tempoMedioEmFilaPortariaHoras!: number | null;

  @ApiProperty()
  tempoMedioEmFilaGateHoras!: number | null;

  @ApiProperty()
  tempoMedioEmFilaPatioHoras!: number | null;

  @ApiProperty()
  violacoesGateSemPortaria!: number;

  @ApiProperty()
  violacoesSaidaSemCompleto!: number;

  @ApiProperty({ description: 'Violações ativas não persistem — valor referencial 0' })
  conflitosPosicaoPatio!: number;

  @ApiProperty()
  isoDuplicado!: number;

  @ApiProperty({ type: [DashboardPerformanceOpDto] })
  operadoresComMaisRetrabalho!: DashboardPerformanceOpDto[];
}

export class DashboardPerformanceDiaDto {
  @ApiProperty()
  dia!: string;

  @ApiProperty()
  operacoes!: number;
}

export class DashboardPerformanceMesValorDto {
  @ApiProperty({ example: '2026-04' })
  mes!: string;

  @ApiProperty()
  valor!: number;
}

export class DashboardPerformanceSeriesDto {
  @ApiProperty({ type: [DashboardPerformanceDiaDto] })
  produtividadeDiaria30d!: DashboardPerformanceDiaDto[];

  @ApiPropertyOptional({ type: [DashboardPerformanceMesValorDto] })
  margemMensal12m!: DashboardPerformanceMesValorDto[] | null;

  @ApiPropertyOptional({ type: [DashboardPerformanceMesValorDto] })
  custoMedioMensal12m!: DashboardPerformanceMesValorDto[] | null;
}

export class DashboardPerformanceResponseDto {
  @ApiProperty({ type: DashboardPerformanceEstrategicosDto })
  estrategicos!: DashboardPerformanceEstrategicosDto;

  @ApiProperty({ type: DashboardPerformanceProdHumanaDto })
  produtividadeHumana!: DashboardPerformanceProdHumanaDto;

  @ApiPropertyOptional({ type: DashboardPerformanceMargemCustoDto })
  margemCusto!: DashboardPerformanceMargemCustoDto | null;

  @ApiProperty({ type: DashboardPerformanceGargalosDto })
  gargalos!: DashboardPerformanceGargalosDto;

  @ApiProperty({ type: DashboardPerformanceSeriesDto })
  series!: DashboardPerformanceSeriesDto;

  @ApiProperty()
  periodoAplicado!: { dataInicio: string; dataFim: string };

  @ApiProperty()
  geradoEm!: string;

  @ApiProperty()
  parametrosProxy!: {
    custoMinutoProxy: number;
    limiteFilaGargalo: number;
    capacidadePatioEstimada: number;
  };
}
