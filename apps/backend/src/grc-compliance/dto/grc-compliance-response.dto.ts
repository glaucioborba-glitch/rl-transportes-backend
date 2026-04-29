import { ApiProperty } from '@nestjs/swagger';

export class RiscoGrcRespostaDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  titulo!: string;

  @ApiProperty()
  descricao!: string;

  @ApiProperty()
  categoria!: string;

  @ApiProperty()
  probabilidade!: number;

  @ApiProperty()
  impacto!: number;

  @ApiProperty({ description: 'probabilidade × impacto (1–25)' })
  severidade!: number;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  responsavel!: string;

  @ApiProperty()
  origem!: string;

  @ApiProperty()
  createdAt!: string;
}

export class ControleGrcRespostaDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  nomeControle!: string;

  @ApiProperty()
  riscoRelacionadoId!: string;

  @ApiProperty()
  frequencia!: string;

  @ApiProperty()
  responsavel!: string;

  @ApiProperty({ required: false })
  evidencia?: string;

  @ApiProperty()
  eficacia!: number;

  @ApiProperty()
  createdAt!: string;
}

export class PlanoAcaoGrcRespostaDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  what!: string;

  @ApiProperty()
  why!: string;

  @ApiProperty()
  where!: string;

  @ApiProperty()
  when!: string;

  @ApiProperty()
  who!: string;

  @ApiProperty()
  how!: string;

  @ApiProperty()
  howMuch!: number;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  createdAt!: string;
}

export class IncidenteComplianceDto {
  @ApiProperty()
  codigo!: string;

  @ApiProperty({ enum: ['baixa', 'media', 'alta', 'critica'] })
  severidade!: string;

  @ApiProperty()
  area!: string;

  @ApiProperty()
  descricao!: string;

  @ApiProperty()
  fonteDados!: string;
}

export class AuditoriaInteligenteRespostaDto {
  @ApiProperty({ type: [IncidenteComplianceDto] })
  incidentes!: IncidenteComplianceDto[];

  @ApiProperty({ minimum: 0, maximum: 100 })
  scoreCompliance!: number;

  @ApiProperty({ type: [String] })
  areasCriticas!: string[];

  @ApiProperty({ type: [String] })
  recomendacoes!: string[];
}

export class GapAnalysisCertificacaoDto {
  @ApiProperty()
  indiceAderenciaISO!: number;

  @ApiProperty()
  indiceAderenciaOEA!: number;

  @ApiProperty()
  indiceAderenciaISPS!: number;

  @ApiProperty({ type: [String] })
  gaps!: string[];

  @ApiProperty({
    description:
      'Modelo 5W2H sugerido com base no pior índice — sem persistência automática.',
  })
  planoAcaoSugerido!: {
    what: string;
    why: string;
    where: string;
    when: string;
    who: string;
    how: string;
    howMuch: number;
  };
}

export class DashboardGrcDto {
  @ApiProperty()
  riscosPorSeveridade!: Record<string, number>;

  @ApiProperty({ description: 'Faixas de eficácia 0–100' })
  controlesPorEficacia!: Record<string, number>;

  @ApiProperty()
  scoreCompliance!: number;

  @ApiProperty()
  aderenciaISO!: number;

  @ApiProperty()
  aderenciaOEA!: number;

  @ApiProperty()
  aderenciaISPS!: number;

  @ApiProperty()
  incidentesPorArea!: Record<string, number>;

  @ApiProperty()
  planosAtivos!: number;

  @ApiProperty()
  planosConcluidos!: number;

  @ApiProperty()
  mapaRiscoCorporativo!: Record<string, number>;
}
