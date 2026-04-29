import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DashboardFinanceiroDonutDto {
  @ApiProperty({ description: 'Valor faturado com boleto liquidado (status PAGO)' })
  concluido!: number;

  @ApiProperty({ description: 'Valor ainda em aberto (pendente ou vencido no boleto)' })
  pendente!: number;

  @ApiPropertyOptional({
    description: 'Participação percentual',
    example: { concluido: 62.5, pendente: 37.5 },
  })
  percentual!: { concluido: number; pendente: number };
}

export class DashboardFinanceiroSnapshotDto {
  @ApiProperty()
  faturamentoTotalPeriodo!: number;

  @ApiProperty({ description: 'Quantidade de cabeçalhos de faturamento no período' })
  quantidadeFaturamentos!: number;

  @ApiProperty({ description: 'Somatório dos itens de faturamento no período (conferência)' })
  somaItensFaturamento!: number;

  @ApiProperty({ type: DashboardFinanceiroDonutDto })
  faturamentoConcluidoVsPendente!: DashboardFinanceiroDonutDto;

  @ApiProperty({
    description:
      'Ticket médio: faturamento total / solicitações distintas vinculadas aos faturamentos do período',
  })
  mediaTicketPorSolicitacao!: number | null;

  @ApiProperty({
    description: 'Variação % do faturamento total vs competência imediatamente anterior (MoM)',
  })
  variacaoMesAMesPercent!: number | null;
}

export class DashboardFinanceiroReceitaPorClienteDto {
  @ApiProperty()
  clienteId!: string;

  @ApiProperty()
  clienteNome!: string;

  @ApiProperty()
  valorTotal!: number;

  @ApiProperty({ description: 'Participação no total do período (%)' })
  participacaoPercent!: number;
}

export class DashboardFinanceiroPorServicoDto {
  @ApiProperty({
    description: 'Descrição da linha no item de faturamento (proxy até existir catálogo de serviços)',
  })
  descricaoLinha!: string;

  @ApiProperty()
  valorTotal!: number;
}

export class DashboardFinanceiroRankingInadimplenciaDto {
  @ApiProperty()
  clienteId!: string;

  @ApiProperty()
  clienteNome!: string;

  @ApiProperty()
  valorVencido!: number;

  @ApiProperty()
  quantidadeBoletosVencidos!: number;
}

export class DashboardFinanceiroReceitaDto {
  @ApiProperty({ type: [DashboardFinanceiroReceitaPorClienteDto] })
  faturamentoPorClienteTop10!: DashboardFinanceiroReceitaPorClienteDto[];

  @ApiProperty({ type: [DashboardFinanceiroPorServicoDto] })
  faturamentoPorServico!: DashboardFinanceiroPorServicoDto[];

  @ApiProperty()
  mediaTicketPorSolicitacao!: number | null;

  @ApiProperty({ type: DashboardFinanceiroDonutDto })
  donut!: DashboardFinanceiroDonutDto;
}

export class DashboardFinanceiroInadimplenciaDto {
  @ApiProperty()
  boletosPendentes!: number;

  @ApiProperty()
  boletosVencidos!: number;

  @ApiProperty()
  valorVencidoTotal!: number;

  @ApiProperty({
    description:
      'Valor vencido em aberto / valor total dos boletos analisados (excl. cancelados)',
  })
  taxaInadimplenciaGeralPercent!: number | null;

  @ApiProperty({ type: [DashboardFinanceiroRankingInadimplenciaDto] })
  inadimplenciaPorCliente!: DashboardFinanceiroRankingInadimplenciaDto[];

  @ApiProperty({ description: 'Projeção por média ponderada (peso maior nos últimos meses da série)' })
  forecastInadimplenciaPercent!: number | null;

  @ApiProperty({ description: 'Próximo mês por média móvel dos últimos 3 meses faturados' })
  forecastFaturamentoProximoMes!: number | null;
}

export class DashboardFinanceiroRentabilidadeDto {
  @ApiProperty()
  proxyMargemOperacional!: number | null;

  @ApiProperty()
  faturamentoPorContainer!: number | null;

  @ApiProperty()
  totalUnidadesConsideradas!: number;
}

export class DashboardFinanceiroAgingDto {
  @ApiProperty({ example: '0-30' })
  faixa!: string;

  @ApiProperty()
  valorTotal!: number;

  @ApiProperty()
  quantidadeBoletos!: number;
}

export class DashboardFinanceiroSerieTemporalDto {
  @ApiProperty({ example: '2026-04' })
  mes!: string;

  @ApiProperty()
  faturado!: number;

  @ApiProperty({ description: 'Soma boletos PAGO no recorte do período da série' })
  recebido!: number;

  @ApiProperty()
  pendente!: number;

  @ApiProperty()
  vencido!: number;
}

export class DashboardFinanceiroAbcDto {
  @ApiProperty()
  clienteId!: string;

  @ApiProperty()
  clienteNome!: string;

  @ApiProperty()
  valor!: number;

  @ApiProperty()
  percentualAcumulado!: number;

  @ApiProperty({ enum: ['A', 'B', 'C'] })
  classe!: 'A' | 'B' | 'C';
}

export class DashboardFinanceiroVisaoClienteDto {
  @ApiProperty()
  clienteId!: string;

  @ApiProperty()
  clienteNome!: string;

  @ApiProperty()
  faturamentoTotalPeriodo!: number;

  @ApiProperty()
  quantidadeBoletosAbertos!: number;

  @ApiProperty()
  valorInadimplente!: number;
}

export class DashboardFinanceiroClientesDto {
  @ApiProperty({ type: [DashboardFinanceiroAbcDto] })
  curvaAbc!: DashboardFinanceiroAbcDto[];

  @ApiProperty()
  corporate!: {
    receitaPj: number;
    receitaPf: number;
    percentualParticipacaoPj: number | null;
  };

  @ApiPropertyOptional({ type: DashboardFinanceiroVisaoClienteDto })
  visaoClienteFiltrado!: DashboardFinanceiroVisaoClienteDto | null;
}

export class DashboardFinanceiroExecutivoResponseDto {
  @ApiProperty({ type: DashboardFinanceiroSnapshotDto })
  snapshot!: DashboardFinanceiroSnapshotDto;

  @ApiProperty({ type: DashboardFinanceiroReceitaDto })
  receita!: DashboardFinanceiroReceitaDto;

  @ApiProperty({ type: DashboardFinanceiroInadimplenciaDto })
  inadimplencia!: DashboardFinanceiroInadimplenciaDto;

  @ApiProperty({ type: DashboardFinanceiroRentabilidadeDto })
  rentabilidade!: DashboardFinanceiroRentabilidadeDto;

  @ApiProperty({ type: [DashboardFinanceiroAgingDto] })
  aging!: DashboardFinanceiroAgingDto[];

  @ApiProperty({ type: [DashboardFinanceiroSerieTemporalDto] })
  series!: DashboardFinanceiroSerieTemporalDto[];

  @ApiProperty({ type: DashboardFinanceiroClientesDto })
  clientes!: DashboardFinanceiroClientesDto;

  @ApiProperty()
  periodoAplicado!: { periodoInicio: string; periodoFim: string };

  @ApiProperty()
  geradoEm!: string;
}
