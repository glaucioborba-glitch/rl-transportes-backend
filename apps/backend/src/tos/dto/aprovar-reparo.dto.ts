import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class AprovarReparoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacao?: string;

  @ApiPropertyOptional({ description: 'Valor do reparo para faturamento' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  valorReparo?: number;
}
