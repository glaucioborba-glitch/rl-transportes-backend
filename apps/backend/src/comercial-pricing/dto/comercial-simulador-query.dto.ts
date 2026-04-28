import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

export class ComercialSimuladorQueryDto {
  @ApiProperty({ example: 150.5 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  precoAtual!: number;

  @ApiProperty({ example: 165 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  precoNovo!: number;

  @ApiProperty({ description: 'Custo médio por unidade/operação no cenário' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  custo!: number;

  @ApiProperty({ example: 320 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  volumeAtual!: number;

  @ApiPropertyOptional({
    description:
      'Elasticidade estimada (negativa). Se omitido, usa default interno para what-if conservador.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  elasticidade?: number;

  @ApiPropertyOptional({ description: 'Rótulo opcional ex.: YYYY-MM', example: '2026-04' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  periodo?: string;
}
