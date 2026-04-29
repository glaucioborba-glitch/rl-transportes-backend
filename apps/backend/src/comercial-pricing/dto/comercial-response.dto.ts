import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ComercialParametrosCustoDto {
  @ApiProperty()
  custoOperacionalTotalEstimado!: number;

  @ApiProperty()
  operacoesInsertConsideradas!: number;

  @ApiPropertyOptional({ description: 'Média horas ciclo completo (proxy performance)' })
  cicloMedioHoras!: number | null;

  @ApiProperty()
  custoMinutoProxy!: number;
}

export class ComercialCurvaAbcItemDto {
  @ApiProperty()
  clienteId!: string;

  @ApiProperty()
  clienteNome!: string;

  @ApiProperty({ description: 'Soma faturamentos no período' })
  faturamento!: number;

  @ApiProperty({ description: 'Alocado proporcionalmente ao faturamento' })
  custoEstimado!: number;

  @ApiProperty()
  lucro!: number;

  @ApiProperty({ description: 'lucro / faturamento, quando faturamento > 0' })
  margemPct!: number | null;

  @ApiProperty({ enum: ['A', 'B', 'C'] })
  classe!: 'A' | 'B' | 'C';

  @ApiProperty({
    description:
      'Percentual acumulado do lucro positivo total após este registro (ver `modoOrdenacaoAbc`).',
  })
  contribuicaoLucroAcumPct!: number;
}

export class ComercialCurvaAbcRespostaDto {
  @ApiProperty()
  periodo!: { dataInicio: string; dataFim: string };

  @ApiPropertyOptional({
    enum: ['lucro', 'margem'],
    description: '`lucro`: ordenação por lucro absoluto. `margem`: ordenação por margem % antes do acumulado.',
  })
  modoOrdenacaoAbc?: 'lucro' | 'margem';

  @ApiProperty({ type: ComercialParametrosCustoDto })
  parametros!: ComercialParametrosCustoDto;

  @ApiProperty()
  concentracao!: { classeA: number; classeB: number; classeC: number };

  @ApiProperty({ type: [ComercialCurvaAbcItemDto] })
  itens!: ComercialCurvaAbcItemDto[];
}

export class ComercialSerieMesValorDto {
  @ApiProperty({ example: '2026-03' })
  mes!: string;

  @ApiProperty()
  faturamento!: number;

  @ApiProperty()
  custoEstimado!: number;

  @ApiPropertyOptional()
  margemPct!: number | null;
}

export class ComercialClienteLucroDto {
  @ApiProperty()
  clienteId!: string;

  @ApiProperty()
  clienteNome!: string;

  @ApiProperty()
  faturamento!: number;

  @ApiProperty()
  custoEstimado!: number;

  @ApiProperty()
  lucro!: number;

  @ApiPropertyOptional()
  margemPct!: number | null;

  @ApiProperty({ type: [ComercialSerieMesValorDto] })
  serie12Meses!: ComercialSerieMesValorDto[];
}

export class ComercialLucroPorClienteRespostaDto {
  @ApiProperty()
  periodo!: { dataInicio: string; dataFim: string };

  @ApiProperty({ type: ComercialParametrosCustoDto })
  parametros!: ComercialParametrosCustoDto;

  @ApiProperty({ type: [ComercialClienteLucroDto] })
  clientes!: ComercialClienteLucroDto[];
}

export class ComercialServicoLucroDto {
  @ApiProperty({ enum: ['IMPORT', 'EXPORT', 'GATE_IN', 'GATE_OUT'] })
  tipo!: string;

  @ApiProperty()
  unidades!: number;

  @ApiProperty({ description: 'Receita alocada proporcionalmente ao mix de unidades' })
  faturamentoAlocado!: number;

  @ApiProperty()
  custoEstimado!: number;

  @ApiProperty()
  lucro!: number;

  @ApiPropertyOptional()
  margemPct!: number | null;
}

export class ComercialLucroPorServicoRespostaDto {
  @ApiProperty()
  periodo!: { dataInicio: string; dataFim: string };

  @ApiProperty({ type: ComercialParametrosCustoDto })
  parametros!: ComercialParametrosCustoDto;

  @ApiProperty({ type: [ComercialServicoLucroDto] })
  servicos!: ComercialServicoLucroDto[];
}

export class ComercialSerieElasticidadeMesDto {
  @ApiProperty()
  mes!: string;

  @ApiProperty()
  volumeUnidades!: number;

  @ApiProperty({ description: 'Faturamento / volume (proxy preço médio)' })
  precoMedio!: number;
}

export class ComercialElasticidadeRespostaDto {
  @ApiProperty()
  mesesConsiderados!: number;

  @ApiPropertyOptional({
    description:
      'Elasticidade média (%Δvolume / %Δpreço) entre meses consecutivos; negativa = lei da demanda',
  })
  elasticidadeMedia!: number | null;

  @ApiProperty({ type: [ComercialSerieElasticidadeMesDto] })
  serie!: ComercialSerieElasticidadeMesDto[];

  @ApiPropertyOptional()
  clienteId!: string | null;
}

export class ComercialSerieTemporalMesDto {
  @ApiProperty({ example: '2026-03' })
  mes!: string;

  @ApiProperty()
  faturamento!: number;

  @ApiProperty()
  custoEstimado!: number;

  @ApiProperty()
  lucro!: number;

  @ApiPropertyOptional()
  margemPct!: number | null;
}

export class ComercialSeriesTemporaisRespostaDto {
  @ApiProperty({ enum: [6, 12] })
  meses!: 6 | 12;

  @ApiProperty()
  periodo!: { dataInicio: string; dataFim: string };

  @ApiPropertyOptional()
  clienteId!: string | null;

  @ApiProperty({ type: ComercialParametrosCustoDto })
  parametros!: ComercialParametrosCustoDto;

  @ApiProperty({ type: [ComercialSerieTemporalMesDto] })
  serie!: ComercialSerieTemporalMesDto[];
}

export class ComercialIndicadoresRespostaDto {
  @ApiProperty()
  periodo!: { dataInicio: string; dataFim: string };

  @ApiPropertyOptional()
  clienteId!: string | null;

  @ApiProperty()
  faturamentoTotal!: number;

  @ApiProperty()
  lucroEstimado!: number;

  @ApiPropertyOptional({ description: 'Lucro estimado / faturamento total no recorte' })
  margemMediaPct!: number | null;

  @ApiProperty({ description: 'Clientes distintos com pelo menos um faturamento no período' })
  quantidadeClientesComFaturamento!: number;

  @ApiPropertyOptional({
    description: 'Referência: série móvel 12 meses até hoje (mesma base da rota /elasticidade)',
  })
  elasticidadeDemandaMedia!: number | null;

  @ApiProperty({ type: ComercialParametrosCustoDto })
  parametros!: ComercialParametrosCustoDto;
}

export class ComercialSimuladorRespostaDto {
  @ApiPropertyOptional()
  periodoRotulo!: string | null;

  @ApiPropertyOptional()
  margemAtual!: number | null;

  @ApiPropertyOptional()
  margemNova!: number | null;

  @ApiProperty({
    description: 'Impacto linear receita = (preço novo − atual) × volume atual',
  })
  impactoReceitaLinear!: number;

  @ApiProperty()
  impactoVolumeEstimado!: number;

  @ApiProperty()
  receitaAtual!: number;

  @ApiProperty()
  receitaNovaEstimada!: number;

  @ApiProperty()
  volumeEstimado!: number;

  @ApiProperty({ description: 'Elasticidade usada na projeção de volume' })
  elasticidadeAplicada!: number;
}

export class ComercialRecomendacaoDto {
  @ApiProperty({
    enum: ['reajuste', 'pacote', 'contrato', 'ocupacao', 'alerta', 'desconto'],
  })
  tipo!: 'reajuste' | 'pacote' | 'contrato' | 'ocupacao' | 'alerta' | 'desconto';

  @ApiPropertyOptional()
  clienteId!: string | null;

  @ApiPropertyOptional()
  clienteNome!: string | null;

  @ApiProperty()
  titulo!: string;

  @ApiProperty()
  descricao!: string;

  @ApiPropertyOptional()
  prioridade!: 'alta' | 'media' | 'baixa';
}

export class ComercialRecomendacoesRespostaDto {
  @ApiProperty()
  periodo!: { dataInicio: string; dataFim: string };

  @ApiProperty({ type: [ComercialRecomendacaoDto] })
  recomendacoes!: ComercialRecomendacaoDto[];
}
