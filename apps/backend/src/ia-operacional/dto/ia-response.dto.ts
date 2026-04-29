import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { HorizonteHoras } from '../ia-operacional.calculations';
import { TurnoIa } from './ia-turno.enum';

export class IaMetricasConfiancaRespostaDto {
  @ApiProperty({ minimum: 0, maximum: 1 })
  score!: number;

  @ApiProperty({ enum: ['alta', 'media', 'baixa'] })
  nivel!: 'alta' | 'media' | 'baixa';

  @ApiProperty()
  observacoesConsideradas!: number;
}

export class IaSazonalidadeRespostaDto {
  @ApiProperty({ description: 'Dispersão P90–P10 normalizada (aprox.)' })
  amplitudePct!: number;

  @ApiProperty()
  descricao!: string;
}

export class IaGargaloHorizonteRespostaDto {
  @ApiProperty({ enum: [2, 4, 8] })
  horas!: HorizonteHoras;

  @ApiProperty({
    description:
      'Probabilidade estimada de congestionamento na etapa até liberação do Gate',
    minimum: 0,
    maximum: 1,
  })
  probabilidadePortaria!: number;

  @ApiProperty({
    description: 'Probabilidade estimada de congestionamento Gate→Pátio',
    minimum: 0,
    maximum: 1,
  })
  probabilidadeGate!: number;

  @ApiProperty({
    description: 'Probabilidade estimada de congestionamento no pátio até saída',
    minimum: 0,
    maximum: 1,
  })
  probabilidadePatio!: number;

  @ApiProperty({
    description: 'Probabilidade estimada de fila/atraso na etapa de saída',
    minimum: 0,
    maximum: 1,
  })
  probabilidadeSaida!: number;
}

export class IaGargalosRespostaDto {
  @ApiProperty({ type: [IaGargaloHorizonteRespostaDto] })
  horizontes!: IaGargaloHorizonteRespostaDto[];

  @ApiProperty({ type: IaMetricasConfiancaRespostaDto })
  metricasConfianca!: IaMetricasConfiancaRespostaDto;

  @ApiProperty({
    enum: ['subindo', 'estavel', 'descendo'],
    description: 'Comparativo primeira vs segunda metade da série agregada de tempos',
  })
  tendencia!: 'subindo' | 'estavel' | 'descendo';

  @ApiProperty({ type: IaSazonalidadeRespostaDto })
  sazonaliade!: IaSazonalidadeRespostaDto;

  @ApiPropertyOptional({
    description: 'Volume de ciclos completos utilizados (Portaria→Saída)',
  })
  amostrasCompletas!: number;
}

export class IaOcrGateRespostaDto {
  @ApiPropertyOptional()
  placa!: string | null;

  @ApiProperty()
  placaValidaMercosul!: boolean;

  @ApiPropertyOptional()
  numeroIso!: string | null;

  @ApiProperty()
  numeroIsoValido6346!: boolean;

  @ApiPropertyOptional()
  tipoContainer!: string | null;

  @ApiPropertyOptional()
  fullness!: string | null;

  @ApiPropertyOptional()
  lacre!: string | null;

  @ApiProperty({
    enum: ['GOOGLE_VISION', 'AWS_REKOGNITION', 'OPENCV_STUB'],
    description: 'Provider mock usado nesta leitura (produção trocará por integração real)',
  })
  providerUsado!: string;

  @ApiProperty({ minimum: 0, maximum: 1 })
  confiancaLeitura!: number;
}

export class IaCicloPrevistoRespostaDto {
  @ApiProperty()
  previstoMinutos!: number;

  @ApiProperty()
  desvioPadraoMinutos!: number;

  @ApiProperty()
  bandaInferiorMinutos!: number;

  @ApiProperty()
  bandaSuperiorMinutos!: number;

  @ApiPropertyOptional({
    description: 'Multiplicador (>1 piora previsão em picos típicos)',
  })
  fatorHorarioChegada!: number;

  @ApiProperty()
  amostrasConsideradas!: number;
}

export class IaPatioHotspotRespostaDto {
  @ApiProperty()
  quadra!: string;

  @ApiProperty()
  ocupacaoRelativa!: number;

  @ApiProperty({ description: 'Ocupação / capacidade estimada da quadra (%)' })
  saturacaoPct!: number;
}

export class IaPatioRecomendacaoRespostaDto {
  @ApiProperty()
  quadraOrigem!: string;

  @ApiProperty()
  quadraDestino!: string;

  @ApiProperty()
  prioridade!: number;

  @ApiProperty()
  motivo!: string;
}

export class IaPatioRecomendacoesRespostaDto {
  @ApiProperty()
  ocupacaoTotalSlots!: number;

  @ApiProperty({ type: [IaPatioHotspotRespostaDto] })
  hotspots!: IaPatioHotspotRespostaDto[];

  @ApiProperty({ type: [IaPatioRecomendacaoRespostaDto] })
  recomendacoes!: IaPatioRecomendacaoRespostaDto[];
}

export class IaProdutividadeOperadorRespostaDto {
  @ApiProperty({ enum: TurnoIa })
  turno!: TurnoIa;

  @ApiPropertyOptional()
  operadorId!: string | null;

  @ApiProperty({ description: 'Eventos INSERT operacionais previstos por hora no turno' })
  produtividadePrevistaOpsHora!: number;

  @ApiProperty({
    description: 'Etapa com maior pressão média no mesmo turno (histórico)',
  })
  gargaloDominantePorTurno!: string;

  @ApiProperty({
    description: 'Quantidade de usuários com volume anômalo vs média do turno',
  })
  outliersDetectados!: number;

  @ApiProperty()
  eventosHistoricosNoTurno!: number;
}
