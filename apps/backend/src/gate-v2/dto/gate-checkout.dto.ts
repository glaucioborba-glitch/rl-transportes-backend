import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { GateDivergenciaItemDto } from './gate-divergencia.dto';

export class GateCheckOutDto {
  @ApiPropertyOptional({ type: [GateDivergenciaItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GateDivergenciaItemDto)
  divergenciasOperador?: GateDivergenciaItemDto[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  avarias?: string[];
}