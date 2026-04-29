import { ApiProperty } from '@nestjs/swagger';

export class AvaliacaoRhRespostaDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  colaboradorId!: string;

  @ApiProperty({ required: false })
  turnoReferencia?: string;

  @ApiProperty({ required: false })
  cargoReferencia?: string;

  @ApiProperty()
  periodo!: string;

  @ApiProperty()
  avaliador!: string;

  @ApiProperty()
  notaTecnica!: number;

  @ApiProperty()
  notaComportamental!: number;

  @ApiProperty()
  aderenciaProcedimentos!: number;

  @ApiProperty()
  qualidadeExecucao!: number;

  @ApiProperty()
  comprometimento!: number;

  @ApiProperty({ required: false })
  comentarioGerencial?: string;

  @ApiProperty({
    description:
      'Média ponderada: 40% operacional + 30% comportamental + 30% técnica (ver API docs).',
  })
  scoreFinal!: number;

  @ApiProperty()
  createdAt!: string;
}

export class OkrRhRespostaDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  objetivo!: string;

  @ApiProperty()
  escopo!: string;

  @ApiProperty({ type: [String] })
  keyResults!: string[];

  @ApiProperty()
  progressoAtual!: number;

  @ApiProperty()
  periodoInicio!: string;

  @ApiProperty()
  periodoFim!: string;

  @ApiProperty()
  responsavel!: string;

  @ApiProperty()
  createdAt!: string;
}

export class TreinamentoRhRespostaDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  colaboradorId!: string;

  @ApiProperty()
  modulo!: string;

  @ApiProperty()
  cargaHoraria!: number;

  @ApiProperty()
  status!: string;

  @ApiProperty({ required: false })
  dataConclusao?: string;

  @ApiProperty()
  createdAt!: string;
}

export class BaselineCargoDto {
  @ApiProperty()
  cargo!: string;

  @ApiProperty()
  scoreMedio!: number;

  @ApiProperty()
  amostras!: number;
}

export class RhKpisRespostaDto {
  @ApiProperty({ description: 'Proxy ou folha-rh via env RH_PERF_ABSENTEISMO_PCT' })
  absenteismoPct!: number;

  @ApiProperty()
  turnoverPct!: number;

  @ApiProperty()
  mediaHorasExtrasPorColaborador!: number;

  @ApiProperty({
    description:
      'Por turno — IA-operacional via proxies RH_PERF_PRODUTIVIDADE_IA_MANHA etc.',
  })
  produtividadePorTurno!: Record<string, number>;

  @ApiProperty({ description: 'Proxy retrabalho RH_PERF_RETRABALHO_PCT' })
  retrabalhoOperacionalPct!: number;

  @ApiProperty({ description: 'Proxy SLA dashboards RH_PERF_SLA_ADERENCIA_PCT' })
  aderenciaSlaPct!: number;

  @ApiProperty({
    description:
      'Custo MO por operação — proxy alinhado folha-rh / tesouraria (RH_PERF_CUSTO_MO_OPERACAO)',
  })
  custoMoPorOperacao!: number;

  @ApiProperty({ type: [BaselineCargoDto] })
  baselinePorCargo!: BaselineCargoDto[];

  @ApiProperty()
  baselinePorTurno!: Record<string, number>;
}

export class BscPerspectivaDto {
  @ApiProperty()
  nome!: string;

  @ApiProperty({ minimum: 0, maximum: 100 })
  score!: number;

  @ApiProperty({ description: 'KPIs compostos nesta perspectiva (proxy + dados locais)' })
  detalhes!: Record<string, number>;
}

export class BscRhRespostaDto {
  @ApiProperty({ type: [BscPerspectivaDto] })
  perspectivas!: BscPerspectivaDto[];

  @ApiProperty({ description: 'Média das quatro perspectivas' })
  scoreGlobal!: number;
}

export class SugestaoTreinamentoRhDto {
  @ApiProperty()
  colaboradorId!: string;

  @ApiProperty()
  moduloSugerido!: string;

  @ApiProperty()
  motivo!: string;

  @ApiProperty({ enum: ['alta', 'media', 'baixa'] })
  prioridade!: string;
}

export class DashboardRhPerformanceDto {
  @ApiProperty()
  notaMediaGlobal!: number;

  @ApiProperty()
  eficienciaPorTurno!: Record<string, number>;

  @ApiProperty()
  horasTreinamentoRealizadas!: number;

  @ApiProperty({ type: [String] })
  gapsIdentificados!: string[];

  @ApiProperty({ enum: ['subindo', 'estavel', 'caindo'] })
  tendenciaPerformance!: string;

  @ApiProperty({ description: '0–100 — proxy RH_PERF_RISCO_TALENTOS' })
  riscoTalentosCriticos!: number;

  @ApiProperty({ description: 'cargo → média de scoreFinal' })
  mapaCompetencias!: Record<string, number>;

  @ApiProperty()
  okrProgressoMedioPct!: number;
}
