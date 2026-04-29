import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SimuladorCapacidadeRespostaDto {
  @ApiProperty({ description: 'Capacidade total de slots do pátio (parâmetro de política operacional)' })
  capacidadePatioSlotsTotal!: number;

  @ApiProperty({ description: 'Ocupação atual contagem posicionamentos (registros em patios)' })
  ocupacaoAtualUnidades!: number;

  @ApiProperty({ description: 'ocupação / capacidade × 100' })
  fatorSaturacaoPct!: number;

  @ApiProperty()
  capacidadeGateUnidadesPorHoraMedia!: number;

  @ApiProperty({ description: 'Pico por hora do período (unidades/hora)' })
  capacidadeGateUnidadesPorHoraPico!: number;

  @ApiProperty()
  capacidadePortariaUnidadesPorHoraMedia!: number;

  @ApiProperty()
  capacidadePortariaUnidadesPorHoraPico!: number;

  @ApiProperty()
  cicloMedioMinutos!: number | null;

  @ApiProperty()
  quadrasDistintas!: number;

  @ApiProperty()
  slotsPorQuadraEstimado!: number;

  @ApiProperty()
  periodoReferenciaDias!: number;
}

export class SimuladorProjecaoItemDto {
  @ApiProperty({ enum: [7, 14, 30] })
  dias!: 7 | 14 | 30;

  @ApiProperty()
  saturacaoPatioPrevistaPct!: number;

  @ApiProperty()
  demandaPortariaPrevistaUph!: number;

  @ApiProperty()
  throughputGatePrevistoUph!: number;

  @ApiProperty()
  confiancaPct!: number;
}

export class SimuladorProjecaoRespostaDto {
  @ApiProperty({ type: [SimuladorProjecaoItemDto] })
  projecoes!: SimuladorProjecaoItemDto[];

  @ApiProperty()
  saturacaoAtualPct!: number;
}

export class SimuladorCenarioRespostaDto {
  @ApiProperty()
  impactoNaSaturacaoPctPontos!: number;

  @ApiProperty()
  saturacaoResultantePct!: number;

  @ApiProperty()
  impactoNoCicloMinutos!: number;

  @ApiProperty()
  cicloResultanteMinutos!: number;

  @ApiProperty()
  necessidadeExpansaoSlots!: number;

  @ApiProperty()
  necessidadeExpansaoM2Estimada!: number;

  @ApiProperty()
  throughputEsperadoUph!: number;

  @ApiProperty({ type: [String] })
  gargalosProvaveis!: string[];
}

export class SimuladorExpansaoRespostaDto {
  @ApiProperty()
  ganhoSlots!: number;

  @ApiProperty()
  novaCapacidadeTotalSlots!: number;

  @ApiProperty()
  saturacaoAtualPct!: number;

  @ApiProperty()
  saturacaoAposExpansaoPct!: number;

  @ApiProperty()
  reducaoSaturacaoPctPontos!: number;

  @ApiProperty()
  impactoCicloMinutosEstimado!: number;

  @ApiProperty({ description: 'Proxy financeiro — usar apenas para comparação relativa entre cenários' })
  roiOperacionalProxy!: number;

  @ApiPropertyOptional({ description: 'Meses estimados para recuperação simples do investimento proxy; pode ser null' })
  mesesPaybackProxy!: number | null;
}

export class SimuladorTurnoLinhaDto {
  @ApiProperty({ enum: ['MANHA', 'TARDE', 'NOITE'] })
  turno!: 'MANHA' | 'TARDE' | 'NOITE';

  @ApiProperty({ description: 'Eventos INSERT operacionais / hora líquida do turno (aprox.)' })
  produtividadeRelativaUph!: number;
}

export class SimuladorTurnosRespostaDto {
  @ApiProperty({ type: [SimuladorTurnoLinhaDto] })
  porTurno!: SimuladorTurnoLinhaDto[];

  @ApiProperty()
  produtividadeMediaGlobal!: number;

  @ApiPropertyOptional({ description: 'Após aplicar redução/aumento simulados' })
  produtividadeAjustadaProxy!: number;

  @ApiPropertyOptional()
  deltaProdutividadePct!: number;
}
