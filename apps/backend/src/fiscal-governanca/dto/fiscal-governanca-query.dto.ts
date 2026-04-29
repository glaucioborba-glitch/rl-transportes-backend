import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class FiscalGovernancaQueryDto {
  @ApiPropertyOptional({
    description: 'Janela em dias para conciliação e indicadores (retrocede a partir de agora).',
    example: 90,
    default: 90,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(730)
  dias?: number;
}
