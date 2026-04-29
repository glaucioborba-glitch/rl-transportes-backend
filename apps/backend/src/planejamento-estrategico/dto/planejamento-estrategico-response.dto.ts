import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PlanejamentoMesValorDto {
  @ApiProperty({ example: '2026-01' })
  mes!: string;

  @ApiProperty()
  valor!: number;
}

export class PlanejamentoDemandaAnualRespostaDto {
  @ApiProperty({ type: [PlanejamentoMesValorDto], description: 'Volume previsto por mês (próximos 12 meses)' })
  volumePrevisto!: PlanejamentoMesValorDto[];

  @ApiProperty({ minimum: 0, maximum: 100 })
  confianca!: number;

  @ApiProperty({ enum: ['crescimento', 'estavel', 'declinio'] })
  tendencia!: string;

  @ApiPropertyOptional({
    description: 'Meses históricos utilizados na regressão (saídas mensais)',
  })
  mesesHistoricosConsiderados!: number;
}

export class PlanejamentoCenarioFinanceiroInternoDto {
  @ApiProperty()
  receitaTotal!: number;

  @ApiProperty()
  margemTotal!: number;
}

export class PlanejamentoForecastFinanceiroRespostaDto {
  @ApiProperty()
  receitaPrevistaAnual!: number;

  @ApiProperty()
  margemPrevistaAnual!: number;

  @ApiProperty({ type: [PlanejamentoMesValorDto] })
  curva12Meses!: PlanejamentoMesValorDto[];

  @ApiProperty({ type: PlanejamentoCenarioFinanceiroInternoDto })
  otimista!: PlanejamentoCenarioFinanceiroInternoDto;

  @ApiProperty({ type: PlanejamentoCenarioFinanceiroInternoDto })
  base!: PlanejamentoCenarioFinanceiroInternoDto;

  @ApiProperty({ type: PlanejamentoCenarioFinanceiroInternoDto })
  pessimista!: PlanejamentoCenarioFinanceiroInternoDto;

  @ApiPropertyOptional({
    description: 'Margem média histórica proxy (%), custo operacional não deduzido linha a linha',
  })
  margemMediaHistoricaPct!: number;

  @ApiPropertyOptional()
  elasticidadeDemandaProxy!: number;

  @ApiPropertyOptional()
  crescimentoEsperadoPctAnualAplicado!: number;
}

export class PlanejamentoOpexRespostaDto {
  @ApiProperty({ type: [PlanejamentoMesValorDto] })
  custoMensalPrevisto!: PlanejamentoMesValorDto[];

  @ApiProperty({ description: 'Custo médio por unidade movimentada (proxy mensal)' })
  custoPorUnidade!: number;

  @ApiPropertyOptional()
  premissasResumo!: string;
}

export class PlanejamentoCapexLinhaDto {
  @ApiProperty()
  categoria!: string;

  @ApiProperty()
  investimentoEstimado!: number;

  @ApiProperty()
  capacidadeAdicionalSlots!: number;
}

export class PlanejamentoCapexRespostaDto {
  @ApiProperty({ type: [PlanejamentoCapexLinhaDto] })
  linhas!: PlanejamentoCapexLinhaDto[];

  @ApiProperty()
  investimentoNecessario!: number;

  @ApiProperty({ description: 'Slots líquidos associados à expansão física de pátio' })
  impactoCapacidadeSlots!: number;

  @ApiPropertyOptional()
  roiEstimadoMeses12!: number | null;

  @ApiPropertyOptional()
  roiEstimadoMeses24!: number | null;

  @ApiPropertyOptional()
  roiEstimadoMeses36!: number | null;
}

export class PlanejamentoEquilibrioRespostaDto {
  @ApiPropertyOptional()
  mesesAteDeficitCapacidade!: number | null;

  @ApiProperty()
  expansaoReduzCustoPorUnidade!: boolean;

  @ApiProperty()
  sweetSpotOcupacaoPct!: number;

  @ApiProperty()
  observacao!: string;

  @ApiPropertyOptional()
  demandaMediaMensalProjetada!: number;

  @ApiPropertyOptional()
  capacidadeSlotsReferencia!: number;
}

export class PlanejamentoCenarioEstrategicoRespostaDto {
  @ApiProperty()
  impactoEmReceitaPct!: number;

  @ApiProperty()
  impactoEmMargemPctPontos!: number;

  @ApiProperty()
  impactoEmCapacidadePctPontos!: number;

  @ApiProperty({ enum: ['baixo', 'medio', 'alto'] })
  riscoOperacional!: string;

  @ApiProperty()
  recomendacaoExecutiva!: string;
}
