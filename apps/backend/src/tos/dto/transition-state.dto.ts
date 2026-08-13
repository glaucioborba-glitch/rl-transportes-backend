import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContainerEventType } from '@prisma/client';
import { IsEnum, IsObject, IsOptional } from 'class-validator';

export class TransitionStateDto {
  @ApiProperty({ enum: ContainerEventType })
  @IsEnum(ContainerEventType)
  eventType!: ContainerEventType;

  @ApiPropertyOptional({ description: 'Payload livre conforme o tipo de evento' })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
