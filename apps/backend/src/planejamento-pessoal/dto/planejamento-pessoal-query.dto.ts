import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { TurnoPlanejamentoPessoal } from '../planejamento-pessoal.turno';

export class PlanejamentoHeadcountOtimoQueryDto {
  @ApiProperty({ enum: TurnoPlanejamentoPessoal, example: TurnoPlanejamentoPessoal.MANHA })
  @IsEnum(TurnoPlanejamentoPessoal)
  turno!: TurnoPlanejamentoPessoal;

  @ApiProperty({ description: 'Demanda prevista em unidades/dia.', example: 380 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  demandaPrevista!: number;

  @ApiPropertyOptional({
    description:
      'Produtividade histórica em unidades/dia por operador; se omitido, estima via auditoria (90 dias).',
    example: 14.5,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0.001)
  produtividadeHistorica?: number;
}

export class PlanejamentoOrcamentoAnualQueryDto {
  @ApiPropertyOptional({ description: 'Coeficiente de encargos sociais (>=1).', example: 1.78 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(4)
  coeficienteEncargos?: number;

  @ApiPropertyOptional({
    description: 'Custo de horas extras como percentual sobre folha (proxy).',
    example: 8,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(80)
  custoHoraExtraProxyPct?: number;

  @ApiPropertyOptional({
    description: 'Share da parcela de pessoal dentro do OPEX mensal projetado (0,18–0,92).',
    example: 0.52,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0.18)
  @Max(0.92)
  sharePessoalNoOpex?: number;
}

export class PlanejamentoCenarioPessoalQueryDto {
  @ApiPropertyOptional({ example: 2 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  contratar?: number;

  @ApiPropertyOptional({ example: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  demitir?: number;

  @ApiPropertyOptional({ enum: TurnoPlanejamentoPessoal })
  @IsOptional()
  @IsEnum(TurnoPlanejamentoPessoal)
  moverDeTurno?: TurnoPlanejamentoPessoal;

  @ApiPropertyOptional({ enum: TurnoPlanejamentoPessoal })
  @IsOptional()
  @IsEnum(TurnoPlanejamentoPessoal)
  moverParaTurno?: TurnoPlanejamentoPessoal;

  @ApiPropertyOptional({ description: 'Volume mensal estimado de novo cliente (unidades/mês).', example: 900 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  volumeEstimadoNovoCliente?: number;
}

export class PlanejamentoContratacaoQueryDto {
  @ApiPropertyOptional({
    description: 'Doze valores mensais separados por vírgula (ordem cronológica dos próximos 12 meses).',
    example: '1200,1180,1250,1300,1280,1320,1350,1380,1400,1420,1450,1480',
  })
  @IsOptional()
  @IsString()
  demanda12Meses?: string;

  @ApiPropertyOptional({
    description: 'Produtividade média por operador (unidades/mês); se omitido, estima pela auditoria.',
    example: 420,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0.001)
  produtividadePorOperadorMes?: number;

  @ApiPropertyOptional({ description: 'Headcount atual consolidado; se omitido, usa auditoria (90 dias).' })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  headcountAtual?: number;
}
