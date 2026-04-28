import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ComercialPeriodQueryDto } from './comercial-period-query.dto';

export class ComercialElasticidadeQueryDto extends ComercialPeriodQueryDto {
  @ApiPropertyOptional({ description: 'Meses da série (6–24)', default: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(6)
  @Max(24)
  meses?: number;
}
