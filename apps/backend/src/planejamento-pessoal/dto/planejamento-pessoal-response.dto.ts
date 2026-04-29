import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TurnoPlanejamentoPessoal } from '../planejamento-pessoal.turno';

export class MesValorPessoalDto {
  @ApiProperty({ example: '2026-05' })
  mes!: string;

  @ApiProperty({ example: 182340.5 })
  valor!: number;
}

export class PlanejamentoHeadcountOtimoRespostaDto {
  @ApiProperty({ enum: TurnoPlanejamentoPessoal })
  turno!: TurnoPlanejamentoPessoal;

  @ApiProperty()
  demandaPrevistaDia!: number;

  @ApiProperty({ description: 'Unidades/dia por operador utilizada no cálculo.' })
  produtividadePorOperadorDia!: number;

  @ApiProperty()
  headcountAtualProxy!: number;

  @ApiProperty()
  headcountRecomendado!: number;

  @ApiProperty({ description: 'Positivo = excesso de pessoal; negativo = déficit.' })
  deficitOuExcessoAtual!: number;

  @ApiProperty({ enum: ['deficit', 'excesso', 'equilibrado'] })
  tipoSaldo!: 'deficit' | 'excesso' | 'equilibrado';

  @ApiProperty()
  produtividadeEstimadaEquipeRecomendada!: number;

  @ApiProperty({ description: 'Risco operacional por falta de capacidade humana (0–100%).' })
  riscoOperacionalPct!: number;
}

export class PlanejamentoOrcamentoAnualRespostaDto {
  @ApiProperty({ type: [MesValorPessoalDto] })
  custoMensal!: MesValorPessoalDto[];

  @ApiProperty()
  custoAnualPrevisto!: number;

  @ApiProperty({
    description: 'Variação percentual mês a mês; primeiro mês é null.',
    type: [Number],
    nullable: true,
  })
  deltaMesAMesPct!: (number | null)[];

  @ApiProperty()
  coeficienteEncargosAplicado!: number;

  @ApiProperty()
  custoHoraExtraProxyPctAplicado!: number;

  @ApiProperty({ description: 'Premissas curtas para auditoria executiva.' })
  premissasResumo!: string;
}

export class PlanejamentoCenarioPessoalRespostaDto {
  @ApiProperty()
  impactoCapacidadeUnidadesMesPct!: number;

  @ApiProperty({ description: 'Variação estimada no ciclo médio (minutos).' })
  impactoCicloMinutos!: number;

  @ApiProperty()
  impactoCustoPorHoraPct!: number;

  @ApiProperty()
  requisitoTreinamentoHoras!: number;

  @ApiPropertyOptional()
  observacaoMovimentacaoTurnos?: string;
}

export class PlanejamentoMatrizTurnoLinhaDto {
  @ApiProperty({ enum: TurnoPlanejamentoPessoal })
  turno!: TurnoPlanejamentoPessoal;

  @ApiProperty({ description: 'Proxy unidades/dia por operador no turno.' })
  produtividadeRelativa!: number;

  @ApiProperty()
  custoProxyTurnoMensal!: number;

  @ApiProperty()
  operadorHoraNecessarioMes!: number;

  @ApiProperty({
    description: 'Saturação proxy vs capacidade mensal de referência (saídas projetadas).',
  })
  saturacaoPct!: number;

  @ApiProperty({ description: 'Ponto de saturação estimado (%): turnos acima do limiar aparecem como alerta.' })
  pontoSaturacaoTurnoPct!: number;
}

export class PlanejamentoMatrizTurnosRespostaDto {
  @ApiProperty({ type: [PlanejamentoMatrizTurnoLinhaDto] })
  turnos!: PlanejamentoMatrizTurnoLinhaDto[];

  @ApiProperty()
  diasReferencia!: number;

  @ApiProperty()
  capacidadeReferenciaMesUnidades!: number;
}

export class PlanejamentoContratacaoRespostaDto {
  @ApiProperty({ type: [MesValorPessoalDto], description: 'Demanda mensal utilizada (próximos 12 meses).' })
  demandaMensalReferencia!: MesValorPessoalDto[];

  @ApiProperty()
  produtividadePorOperadorMes!: number;

  @ApiProperty()
  headcountAtual!: number;

  @ApiProperty()
  previsaoContratar!: number;

  @ApiProperty()
  previsaoTreinarHoras!: number;

  @ApiProperty({ description: 'Risco de turnover proxy (0–100%).' })
  riscoTurnoverPct!: number;

  @ApiProperty({ description: 'ROI proxy da contratação (margem atribuída / custo de admissão).' })
  roiContratacaoProxy!: number;
}
