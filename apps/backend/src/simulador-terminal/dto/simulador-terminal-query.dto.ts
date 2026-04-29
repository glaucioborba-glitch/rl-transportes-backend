import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class SimuladorProjecaoQueryDto {
  @ApiPropertyOptional({
    enum: [7, 14, 30],
    description: 'Omite para calcular os três horizontes de uma vez',
  })
  @IsOptional()
  @Type(() => Number)
  @IsIn([7, 14, 30])
  horizonteDias?: 7 | 14 | 30;
}

/** Parâmetros opcionais para What-If — omitidos ou zero = baseline atual. */
export class SimuladorCenarioQueryDto {
  @ApiPropertyOptional({ description: 'Variação percentual na demanda esperada', example: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-80)
  @Max(400)
  aumentoDemandaPercentual?: number;

  @ApiPropertyOptional({ description: 'Reduz horas produtivas equivalentes por dia (simula fechar faixa)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(16)
  reducaoTurnoHoras?: number;

  @ApiPropertyOptional({ description: 'Aumenta horas produtivas equivalentes por dia (simula abrir faixa)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(16)
  aumentoTurnoHoras?: number;

  @ApiPropertyOptional({ description: 'Quadras físicas adicionais consideradas no cenário' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(500)
  expansaoQuadras?: number;

  @ApiPropertyOptional({ description: 'Volume mensal estimado (unidades) de novo cliente em operação cheia' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  novoClienteVolumeEstimado?: number;
}

export class SimuladorExpansaoQueryDto {
  @ApiPropertyOptional({ description: 'Quadras a acrescentar no cenário de expansão', example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(500)
  quadrasAdicionais?: number;

  @ApiPropertyOptional({ description: 'Slots médios por quadra (proxy quando não inferido do histórico)', example: 40 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(500)
  slotsPorQuadraEstimado?: number;
}

export class SimuladorTurnosQueryDto {
  @ApiPropertyOptional({
    description:
      'Simula redução de intensidade neste turno (MANHA|TARDE|NOITE) — proxy operacional',
    example: 'NOITE',
  })
  @IsOptional()
  @IsString()
  @IsIn(['MANHA', 'TARDE', 'NOITE'])
  reducaoTurno?: string;

  @ApiPropertyOptional({
    description: 'Simula acréscimo de intensidade neste turno',
    example: 'MANHA',
  })
  @IsOptional()
  @IsString()
  @IsIn(['MANHA', 'TARDE', 'NOITE'])
  aumentoTurno?: string;
}
