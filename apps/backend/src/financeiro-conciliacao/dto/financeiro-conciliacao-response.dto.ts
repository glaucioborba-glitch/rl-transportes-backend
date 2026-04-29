import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ExtratoImportarRespostaDto {
  @ApiProperty()
  batchId!: string;

  @ApiProperty()
  linhasImportadas!: number;

  @ApiProperty({ enum: ['OFX', 'CSV', 'API'] })
  formato!: string;

  @ApiPropertyOptional()
  nomeOrigem?: string;
}

export class ExtratoLoteListaDto {
  @ApiProperty()
  batchId!: string;

  @ApiProperty()
  formato!: string;

  @ApiProperty()
  importadoEm!: string;

  @ApiProperty()
  linhasCount!: number;

  @ApiPropertyOptional()
  nomeOrigem?: string;
}

export class ConciliacaoAutomaticaRespostaDto {
  @ApiProperty({ description: 'Matches automáticos ou manuais válidos.' })
  conciliados!: unknown[];

  @ApiProperty({ description: 'Linhas de crédito sem correspondência.' })
  pendentes!: unknown[];

  @ApiProperty({ description: 'Ambiguidade (vários candidatos).' })
  suspeitos!: unknown[];

  @ApiProperty({ description: 'Valor inconsistente após match.' })
  divergentes!: unknown[];

  @ApiProperty()
  boletosCarregados!: number;

  @ApiProperty()
  linhasExtratoAnalisadas!: number;
}

export class ConciliacaoManualRespostaDto {
  @ApiProperty()
  ok!: boolean;

  @ApiProperty()
  extratoLinhaId!: string;

  @ApiProperty()
  boletoId!: string;

  @ApiProperty()
  faturamentoId!: string;

  @ApiProperty()
  auditoriaRegistrada!: boolean;
}

export class FluxoCaixaRespostaDto {
  @ApiProperty({ enum: [7, 30, 90] })
  horizonte!: 7 | 30 | 90;

  @ApiProperty({ description: 'Projeção linear simplificada no período.' })
  saldoProjetadoFim!: number;

  @ApiProperty()
  entradasPrevistas!: number;

  @ApiProperty()
  saidasPrevistas!: number;

  @ApiProperty({ type: 'object', additionalProperties: true })
  detalhe!: Record<string, unknown>;
}

export class PrevisibilidadeRespostaDto {
  @ApiProperty({ type: 'array', items: { type: 'object' } })
  previsaoReceita12Meses!: Array<{ mes: string; valor: number }>;

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  previsaoMargem12Meses!: Array<{ mes: string; valor: number }>;

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  previsaoCaixa12Meses!: Array<{ mes: string; valor: number }>;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Cenários pessimista / base / otimista (receita e margem anuais).',
  })
  cenarios!: {
    pessimista: { receitaAnual: number; margemAnual: number };
    base: { receitaAnual: number; margemAnual: number };
    otimista: { receitaAnual: number; margemAnual: number };
  };

  @ApiProperty()
  inadimplenciaProjetadaPct!: number;

  @ApiProperty({ description: 'Elasticidade de demanda aplicada (proxy).' })
  elasticidadeProxy!: number;
}

export class DashboardFinanceiroRespostaDto {
  @ApiProperty()
  saldoAtual!: number;

  @ApiProperty()
  recebimentosHoje!: number;

  @ApiProperty()
  pagamentosHoje!: number;

  @ApiProperty()
  saldoPrevisto7d!: number;

  @ApiProperty()
  saldoPrevisto30d!: number;

  @ApiProperty()
  inadimplenciaAtualPct!: number;

  @ApiProperty()
  inadimplenciaProjetadaPct!: number;

  @ApiProperty()
  itensConciliados!: number;

  @ApiProperty()
  divergenciasBancarias!: number;

  @ApiProperty({ description: 'Índice 0–100.' })
  indiceSaudeFinanceira!: number;

  @ApiProperty({ description: 'Persistência de extratos em memória nesta fase.' })
  observacaoExtratos!: string;
}
