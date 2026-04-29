import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class DatahubPeriodQueryDto {
  @ApiPropertyOptional({ example: '2026-01-01', description: 'Início do período (YYYY-MM-DD), filtro em fatos.' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-04-30' })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 500, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 50;

  @ApiPropertyOptional({ enum: ['json', 'csv'], default: 'json' })
  @IsOptional()
  @IsIn(['json', 'csv'])
  formato?: 'json' | 'csv' = 'json';

  @ApiPropertyOptional({
    example: 'FATO_Solicitacoes',
    description: 'Filtrar um fato Kimball; omitir para todos.',
  })
  @IsOptional()
  @IsString()
  fato?: string;

  @ApiPropertyOptional({ example: 'DIM_Clientes' })
  @IsOptional()
  @IsString()
  dim?: string;
}
