import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const GATE_DIVERGENCIA_TIPOS = [
  'PLACA_DIVERGENTE',
  'LACRE_DIVERGENTE',
  'CONTAINER_TROCADO',
  'SETPOINT_INCONSISTENTE',
  'PROCESSO_INCONSISTENTE',
  'OUTRA',
] as const;

export type GateDivergenciaTipo = (typeof GATE_DIVERGENCIA_TIPOS)[number];

export class GateDivergenciaItemDto {
  @ApiProperty({ enum: GATE_DIVERGENCIA_TIPOS })
  @IsString()
  @IsIn([...GATE_DIVERGENCIA_TIPOS])
  tipo!: GateDivergenciaTipo;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  antes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  depois?: string;
}
