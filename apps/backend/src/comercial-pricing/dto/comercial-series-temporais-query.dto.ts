import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsUUID } from 'class-validator';

/** Séries financeiras/comerciais agregadas por competência (YYYY-MM). */
export class ComercialSeriesTemporaisQueryDto {
  @ApiProperty({ enum: [6, 12], description: 'Janela móvel em meses (últimos N meses até hoje).' })
  @Type(() => Number)
  @IsIn([6, 12])
  meses!: 6 | 12;

  @ApiPropertyOptional({ description: 'Restringe faturamento à série deste cliente' })
  @IsOptional()
  @IsUUID()
  clienteId?: string;
}
