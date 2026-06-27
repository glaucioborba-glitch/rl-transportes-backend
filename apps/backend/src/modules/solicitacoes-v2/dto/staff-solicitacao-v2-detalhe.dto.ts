import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Evento da linha do tempo (staff) — ordenação ascendente por `createdAt`. */
export class SolicitacaoV2TimelineItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({
    enum: ['criacao', 'anexo', 'delta', 'aprovacao', 'rejeicao', 'alerta'],
  })
  tipo!: string;

  @ApiProperty()
  titulo!: string;

  @ApiPropertyOptional()
  subtitulo?: string;

  @ApiProperty()
  createdAt!: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  meta?: Record<string, unknown>;
}

export class SolicitacaoV2ResumoRiscoDto {
  @ApiProperty()
  totalAlertas!: number;

  @ApiPropertyOptional({ description: 'Maior score numérico entre alertas vinculados' })
  riscoMax!: number | null;
}

/** Envelope estável da API `GET /v2/solicitacoes/:id` (além do registro Prisma em `solicitacao`). */
export class StaffSolicitacaoV2DetalheEnvelopeDto {
  @ApiProperty()
  solicitacao!: Record<string, unknown>;

  @ApiProperty({ type: [Object] })
  auditoria!: unknown[];

  @ApiProperty({ type: [Object] })
  securityAlerts!: unknown[];

  @ApiProperty({ type: [SolicitacaoV2TimelineItemDto] })
  timeline!: SolicitacaoV2TimelineItemDto[];

  @ApiProperty({
    description:
      'Rótulo alinhado a relatórios/PDF sem alterar enum físico (ex.: APROVADO → APROVADA)',
  })
  statusV2Label!: string;

  @ApiProperty({ type: SolicitacaoV2ResumoRiscoDto })
  resumoRisco!: SolicitacaoV2ResumoRiscoDto;
}
