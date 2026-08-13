import { ApiProperty } from '@nestjs/swagger';
import { TurnoEscala } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsOptional, IsUUID, ValidateIf, ValidateNested } from 'class-validator';

export class EscalaTurnoItemDto {
  @ApiProperty()
  @IsUUID()
  funcionarioId!: string;

  @ApiProperty({ example: '2026-06-15' })
  @IsDateString()
  data!: string;

  @ApiProperty({ enum: TurnoEscala, nullable: true, description: 'null remove escalas do dia' })
  @ValidateIf((o: EscalaTurnoItemDto) => o.turno !== null)
  @IsEnum(TurnoEscala)
  turno!: TurnoEscala | null;
}

export class UpsertEscalasDto {
  @ApiProperty({ type: [EscalaTurnoItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EscalaTurnoItemDto)
  escalas!: EscalaTurnoItemDto[];
}
