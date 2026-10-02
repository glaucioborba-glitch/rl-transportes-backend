import { ApiPropertyOptional } from '@nestjs/swagger';
import { TurnoAgendamento } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export class FilaQueryDto {
  @ApiPropertyOptional({ example: '2026-05-14' })
  @IsOptional()
  @IsDateString()
  dataRef?: string;

  @ApiPropertyOptional({ enum: TurnoAgendamento })
  @IsOptional()
  @IsEnum(TurnoAgendamento)
  turno?: TurnoAgendamento;
}
