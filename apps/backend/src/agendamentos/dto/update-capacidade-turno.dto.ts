import { ApiProperty } from '@nestjs/swagger';
import { TurnoAgendamento } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, Max, Min } from 'class-validator';

export class UpdateCapacidadeTurnoDto {
  @ApiProperty({ enum: TurnoAgendamento })
  @IsEnum(TurnoAgendamento)
  turno!: TurnoAgendamento;

  @ApiProperty({ minimum: 1, maximum: 500 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limiteContainers!: number;
}
