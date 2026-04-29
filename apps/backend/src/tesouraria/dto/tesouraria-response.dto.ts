import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MesValorTesourariaDto {
  @ApiProperty({ example: '2026-04' })
  mes!: string;

  @ApiProperty()
  valor!: number;
}

export class DespesaRespostaDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  fornecedor!: string;

  @ApiProperty()
  categoria!: string;

  @ApiProperty()
  descricao!: string;

  @ApiProperty()
  valor!: number;

  @ApiProperty()
  vencimento!: string;

  @ApiProperty({
    description: 'Status persistido na API (entrada do usuário)',
    enum: ['pendente', 'pago', 'atrasado'],
  })
  status!: string;

  @ApiProperty({
    description:
      'Status derivado: vencimento passado e não pago ⇒ atrasado, salvo quando já marcado pago.',
    enum: ['pendente', 'pago', 'atrasado'],
  })
  statusEfetivo!: string;

  @ApiProperty({ enum: ['nenhuma', 'mensal', 'anual'] })
  recorrencia!: string;

  @ApiPropertyOptional()
  documentoReferencia?: string;

  @ApiProperty()
  createdAt!: string;
}

export class FornecedorRespostaDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  nome!: string;

  @ApiProperty()
  cnpj!: string;

  @ApiProperty()
  categoriaFornecedor!: string;

  @ApiProperty()
  contato!: string;

  @ApiProperty()
  prazoPagamentoPadrao!: number;

  @ApiProperty()
  createdAt!: string;
}

export class ContratoRespostaDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  fornecedorId!: string;

  @ApiProperty()
  tipoContrato!: string;

  @ApiProperty()
  valorFixo!: number;

  @ApiProperty()
  vigenciaInicio!: string;

  @ApiProperty()
  vigenciaFim!: string;

  @ApiProperty()
  reajusteAnualPct!: number;

  @ApiProperty({ required: false })
  observacoes?: string;

  @ApiProperty()
  createdAt!: string;
}

export class AgendaPagamentosDto {
  @ApiProperty({ type: [DespesaRespostaDto] })
  despesasPendentes!: DespesaRespostaDto[];

  @ApiProperty({ type: [DespesaRespostaDto] })
  despesasAtrasadas!: DespesaRespostaDto[];

  @ApiProperty({
    description: 'Soma por dia ISO (YYYY-MM-DD)',
    example: { '2026-05-10': 1500 },
  })
  pagamentosPorDia!: Record<string, number>;

  @ApiProperty({
    description: 'Chave = segunda-feira da semana (YYYY-MM-DD)',
  })
  pagamentosPorSemana!: Record<string, number>;

  @ApiProperty({ description: 'Chave YYYY-MM' })
  pagamentosPorMes!: Record<string, number>;
}

export class ImpactoCaixaJanelaDto {
  @ApiProperty()
  janelaDias!: number;

  @ApiProperty({
    description:
      'Saídas OPEX projetadas (despesas exceto CAPEX + parcelas de contrato) no período.',
  })
  saidaTesourariaOpex!: number;

  @ApiProperty({
    description:
      'Saídas totais projetadas no período (inclui CAPEX quando aplicável à projeção).',
  })
  saidaTesourariaTotal!: number;

  @ApiProperty({
    description:
      'Entrada esperada de boletos no horizonte × taxa FINANCEIRO_RECUPERACAO_BOLETOS_PROXY (default 0.65), alinhado à Fase 9.',
  })
  entradaPrevistaBoletos!: number;

  @ApiProperty({
    description: 'Custos fixos mensais prorrateados ao período (FINANCEIRO_CUSTOS_FIXOS_MENSAL).',
  })
  custosFixosProrata!: number;

  @ApiProperty({
    description: 'Saídas comprometidas mensais escaladas ao período (FINANCEIRO_SAIDAS_COMPROMETIDAS_MES).',
  })
  saidasComprometidasProrata!: number;

  @ApiProperty({
    description:
      'Saldo inicial proxy + entradas − custos fixos − comprometidas − saídas tesouraria OPEX.',
  })
  caixaLiquidoProjetado!: number;
}

export class ImpactoCaixaRespostaDto {
  @ApiProperty({ type: ImpactoCaixaJanelaDto })
  impactoOpex7d!: ImpactoCaixaJanelaDto;

  @ApiProperty({ type: ImpactoCaixaJanelaDto })
  impactoOpex15d!: ImpactoCaixaJanelaDto;

  @ApiProperty({ type: ImpactoCaixaJanelaDto })
  impactoOpex30d!: ImpactoCaixaJanelaDto;

  @ApiProperty({ type: ImpactoCaixaJanelaDto })
  impactoOpex90d!: ImpactoCaixaJanelaDto;
}

export class DashboardTesourariaDto {
  @ApiProperty({
    description: 'Soma das despesas com vencimento no mês corrente (projetadas / pontuais).',
  })
  totalDespesasMes!: number;

  @ApiProperty()
  totalDespesasPendentes!: number;

  @ApiProperty()
  despesasAtrasadas!: number;

  @ApiProperty()
  totalContratosAtivos!: number;

  @ApiProperty({ type: [MesValorTesourariaDto] })
  curvaOpex12Meses!: MesValorTesourariaDto[];

  @ApiProperty({ type: [MesValorTesourariaDto] })
  curvaCapex12Meses!: MesValorTesourariaDto[];

  @ApiProperty({ enum: ['baixo', 'medio', 'alto'] })
  riscoSaidasFinanceiras!: string;

  @ApiProperty({ description: 'Score 0–100' })
  confiabilidadeFinanceiraSaidas!: number;
}

export class SugestaoTesourariaDto {
  @ApiProperty()
  tipo!: string;

  @ApiProperty({ enum: ['info', 'warning', 'critical'] })
  severidade!: string;

  @ApiProperty()
  mensagem!: string;

  @ApiProperty({ required: false })
  referencia?: string;
}
