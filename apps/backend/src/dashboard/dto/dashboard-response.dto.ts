import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Item genérico em fila operacional (ordem por registro da etapa). */
export class DashboardFilaItemDto {
  @ApiProperty()
  solicitacaoId!: string;

  @ApiProperty()
  protocolo!: string;

  @ApiProperty()
  clienteId!: string;

  @ApiProperty()
  clienteNome!: string;

  @ApiProperty({ description: 'ISO8601 — momento do registro da etapa ou da solicitação conforme a fila' })
  ordenadoPor!: string;

  @ApiProperty()
  quantidadeUnidades!: number;

  @ApiPropertyOptional({ description: 'Quadra (apenas fila de pátio)' })
  quadra?: string;

  @ApiPropertyOptional({ description: 'Fileira (apenas fila de pátio)' })
  fileira?: string;

  @ApiPropertyOptional({ description: 'Posição (apenas fila de pátio)' })
  posicao?: string;
}

export class DashboardProblemasDto {
  @ApiProperty()
  total!: number;

  @ApiProperty({ description: 'Linhas com mesmo número ISO em mais de uma solicitação ativa (anomalia)' })
  isoDuplicadoEmSolicitacoesAtivas!: number;

  @ApiProperty({ description: 'Gate sem registro de portaria na mesma solicitação' })
  gatesSemPortaria!: number;

  @ApiProperty({ description: 'Saída registrada sem gate ou sem pátio' })
  saidasSemGateOuPatio!: number;

  @ApiProperty({
    description:
      'Concluídas sem fluxo completo (gate+pátio+saída) ou inválidas para telemetria — ver implementação',
  })
  statusInconsistentes!: number;
}

export class DashboardSnapshotDto {
  @ApiProperty({ description: 'Total de unidades (contêineres) em solicitações no pátio sem saída' })
  unidadesNoPatio!: number;

  @ApiProperty()
  unidadesEmPortaria!: number;

  @ApiProperty()
  unidadesEmGate!: number;

  @ApiProperty({ description: 'Solicitações com pátio registrado e sem saída' })
  unidadesEmSaidaPendente!: number;

  @ApiProperty({ description: 'Saídas registradas com data/hora no dia corrente (fuso do servidor)' })
  unidadesConcluidasHoje!: number;

  @ApiProperty({ description: 'Agregado de riscos operacionais detectados (vide campos detalhados)' })
  unidadesComProblemas!: DashboardProblemasDto;
}

export class DashboardRankingClienteDto {
  @ApiProperty()
  clienteId!: string;

  @ApiProperty()
  clienteNome!: string;

  @ApiProperty()
  solicitacoesNoPeriodo!: number;
}

export class DashboardSlaDto {
  @ApiPropertyOptional({ description: 'Média em minutos entre portaria e gate (amostras no período)' })
  tempoMedioPortariaGate?: number | null;

  @ApiPropertyOptional({ description: 'Média em minutos entre gate e pátio' })
  tempoMedioGatePatio?: number | null;

  @ApiPropertyOptional({ description: 'Média em minutos entre pátio e saída' })
  tempoMedioPatioSaida?: number | null;

  @ApiPropertyOptional({ description: 'Estadia média em horas (unidades ainda no pátio sem saída)' })
  idadeMediaEstadiaHoras?: number | null;

  @ApiProperty({ description: 'Solicitações no pátio há mais de 72h sem saída' })
  unidadesComEstadiaCritica!: number;

  @ApiPropertyOptional({
    type: 'array',
    description: 'Ranking por volume de solicitações no período (somente gestão)',
  })
  rankingClientesPorVolume?: DashboardRankingClienteDto[];
}

export class DashboardConflitosDto {
  @ApiProperty({
    description:
      'Violações ativas de posição não persistem no BD (unique); valor referencial/histórico — ver doc',
  })
  conflitosDePosicao!: number;

  @ApiProperty()
  gatesSemPortaria!: number;

  @ApiProperty()
  saidasSemGateOuPatio!: number;

  @ApiProperty()
  unidadesComISORepetido!: number;

  @ApiProperty({ description: 'Registros SEGURANCA na tabela escopo_cliente (tentativas fora do escopo)' })
  tentativas403PorEscopo!: number;
}

export class DashboardOperadorAtivoDto {
  @ApiProperty()
  usuarioId!: string;

  @ApiPropertyOptional()
  email?: string | null;

  @ApiProperty({ description: 'INSERT/UPDATE em portaria/gate/pátio/saída nas últimas 24h' })
  operacoes24h!: number;
}

export class DashboardFilasDto {
  @ApiProperty({ type: [DashboardFilaItemDto] })
  filaPortaria!: DashboardFilaItemDto[];

  @ApiProperty({ type: [DashboardFilaItemDto] })
  filaGate!: DashboardFilaItemDto[];

  @ApiProperty({ type: [DashboardFilaItemDto] })
  filaPatio!: DashboardFilaItemDto[];

  @ApiProperty({
    type: [DashboardFilaItemDto],
    description: 'Solicitações com pátio e sem saída (fila de expedição)',
  })
  filaSaida!: DashboardFilaItemDto[];

  @ApiProperty({ type: [DashboardOperadorAtivoDto] })
  operacoesAtivasPorOperador!: DashboardOperadorAtivoDto[];
}

export class DashboardClienteFinanceiroDto {
  @ApiProperty()
  clienteId!: string;

  @ApiProperty()
  clienteNome!: string;

  @ApiProperty({ description: 'Total de unidades em solicitações ativas' })
  totalUnidades!: number;
}

export class DashboardFaturamentoPendenteDto {
  @ApiProperty()
  clienteId!: string;

  @ApiProperty()
  clienteNome!: string;

  @ApiProperty({
    description: 'Solicitações com saída e ainda sem vínculo em faturamento_solicitacoes',
  })
  solicitacoesElegiveis!: number;
}

export class DashboardPortalPendenteDto {
  @ApiProperty()
  clienteId!: string;

  @ApiProperty()
  clienteNome!: string;

  @ApiProperty({ description: 'Solicitações PENDENTES aguardando aprovação no portal' })
  solicitacoesPendentesAprovacao!: number;
}

export class DashboardClientesDto {
  @ApiProperty({ type: [DashboardClienteFinanceiroDto] })
  unidadesPorCliente!: DashboardClienteFinanceiroDto[];

  @ApiProperty({ type: [DashboardFaturamentoPendenteDto] })
  faturamentoPendentePorCliente!: DashboardFaturamentoPendenteDto[];

  @ApiProperty({ type: [DashboardPortalPendenteDto] })
  unidadesComSolicitacaoAprovacaoNoPortal!: DashboardPortalPendenteDto[];
}

export class DashboardOperacionalResponseDto {
  @ApiProperty()
  geradoEm!: string;

  @ApiProperty()
  periodoAplicado!: { dataInicio: string; dataFim: string };

  @ApiProperty({ type: DashboardSnapshotDto })
  snapshot!: DashboardSnapshotDto;

  @ApiProperty({ type: DashboardSlaDto })
  sla!: DashboardSlaDto;

  @ApiProperty({ type: DashboardConflitosDto })
  conflitos!: DashboardConflitosDto;

  @ApiProperty({ type: DashboardFilasDto })
  filas!: DashboardFilasDto;

  @ApiPropertyOptional({
    type: DashboardClientesDto,
    description: 'Somente ADMIN e GERENTE; omitido para perfis operacionais',
  })
  clientes!: DashboardClientesDto | null;
}
