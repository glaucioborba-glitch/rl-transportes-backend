import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DivergenciaFiscalDto {
  @ApiProperty()
  codigo!: string;

  @ApiProperty({ enum: ['ALTA', 'MEDIA', 'BAIXA'] })
  severidade!: 'ALTA' | 'MEDIA' | 'BAIXA';

  @ApiProperty()
  mensagem!: string;

  @ApiProperty()
  sugestaoCorrecao!: string;

  @ApiPropertyOptional()
  faturamentoId?: string;

  @ApiPropertyOptional()
  nfsEmitidaId?: string;

  @ApiPropertyOptional()
  boletoId?: string;

  @ApiPropertyOptional()
  solicitacaoId?: string;

  @ApiPropertyOptional()
  valorReferencia?: number;

  @ApiPropertyOptional()
  valorComparado?: number;

  @ApiPropertyOptional()
  metadata?: Record<string, unknown>;
}

export class FiscalConciliacaoRespostaDto {
  @ApiProperty({ type: [DivergenciaFiscalDto] })
  divergencias!: DivergenciaFiscalDto[];

  @ApiProperty({ description: 'Total de registros de faturamento analisados na janela.' })
  faturamentosAnalisados!: number;

  @ApiProperty()
  nfsEmitidasAnalisadas!: number;

  @ApiProperty()
  boletosAnalisados!: number;

  @ApiProperty()
  periodoDias!: number;

  @ApiProperty({ description: 'Início UTC da janela aplicada.' })
  dataInicioUtc!: string;
}

export class EventoCriticoAuditoriaDto {
  @ApiProperty()
  tipo!: string;

  @ApiProperty()
  severidade!: 'ALTA' | 'MEDIA' | 'BAIXA';

  @ApiProperty()
  descricao!: string;

  @ApiPropertyOptional()
  auditoriaId?: string;

  @ApiPropertyOptional()
  registroId?: string;

  @ApiPropertyOptional()
  tabela?: string;

  @ApiPropertyOptional()
  metadata?: Record<string, unknown>;
}

export class FiscalAuditoriaInteligenteRespostaDto {
  @ApiProperty({ type: [EventoCriticoAuditoriaDto] })
  eventosCriticos!: EventoCriticoAuditoriaDto[];

  @ApiProperty({ description: '0–100: risco operacional agregado.' })
  scoreRiscoOperacional!: number;

  @ApiProperty({ description: '0–100: risco fiscal agregado (derivado de divergências na mesma janela).' })
  scoreRiscoFiscal!: number;

  @ApiPropertyOptional({
    description:
      'HTTP 401/403 repetidos não são persistidos na auditoria atual; use SEGURANCA em escopo ou logs de API.',
  })
  observacaoHttpAuditoria?: string;
}

export class NfseMonitorItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  faturamentoId!: string;

  @ApiProperty()
  numeroNfe!: string;

  @ApiProperty()
  statusIpm!: string;

  @ApiProperty({ description: 'Bucket municipal normalizado para painel.' })
  bucket!: 'EMITIDO' | 'PENDENTE_MUNICIPIO' | 'CANCELADO' | 'OUTRO';

  @ApiProperty()
  alertaTravada24h!: boolean;

  @ApiPropertyOptional({ description: 'True quando status indica falha/rejeição tratável.' })
  alertaFalhaPrefeitura!: boolean;

  @ApiPropertyOptional()
  horasDesdeAtualizacao!: number;

  @ApiProperty()
  updatedAt!: string;
}

export class FiscalNfseMonitorRespostaDto {
  @ApiProperty({ type: [NfseMonitorItemDto] })
  itens!: NfseMonitorItemDto[];

  @ApiProperty()
  totalSemRetornoMunicipal!: number;

  @ApiProperty()
  totalAguardandoReenvioOuRetry!: number;

  @ApiProperty()
  periodoDias!: number;
}

export class FiscalDashboardRespostaDto {
  @ApiProperty()
  totalFaturadoPeriodo!: number;

  @ApiProperty()
  totalNfseEmitidas!: number;

  @ApiProperty()
  totalNfsePendentes!: number;

  @ApiProperty()
  totalBoletosVencidos!: number;

  @ApiProperty()
  divergenciasAtivas!: number;

  @ApiProperty({ description: 'Percentual 0–100.' })
  riscoFiscalPct!: number;

  @ApiProperty({ description: 'Percentual 0–100.' })
  riscoOperacionalPct!: number;

  @ApiProperty({ description: 'Índice 0–100.' })
  indiceConfiabilidadeFiscal!: number;

  @ApiProperty()
  periodoDias!: number;

  @ApiProperty()
  dataInicioUtc!: string;
}

export class SugestaoSaneamentoDto {
  @ApiProperty()
  codigoDivergencia!: string;

  @ApiProperty()
  acaoSugerida!: string;

  @ApiProperty({ enum: ['ALTA', 'MEDIA', 'BAIXA'] })
  prioridade!: 'ALTA' | 'MEDIA' | 'BAIXA';
}

export class FiscalSaneamentoSugeridoRespostaDto {
  @ApiProperty({ type: [SugestaoSaneamentoDto] })
  sugestoes!: SugestaoSaneamentoDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty({
    description:
      'Somente recomendações determinísticas; não executa emissões nem cancelamentos.',
  })
  observacao!: string;
}
