import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class PlanejamentoForecastFinanceiroQueryDto {
  @ApiPropertyOptional({
    description: 'Crescimento real esperado sobre receita (%, anualizado aplicado ao próximo ano)',
    example: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-30)
  @Max(80)
  crescimentoEsperadoPctAnual?: number;
}

export class PlanejamentoCapexQueryDto {
  @ApiPropertyOptional({
    description: 'Slots adicionais pretendidos na expansão para composição de CAPEX',
    example: 60,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5000)
  expansaoSlotsPlanejados?: number;
}

export class PlanejamentoCenarioEstrategicoQueryDto {
  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-50)
  @Max(120)
  aumentoDemandaPct?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(16)
  reducaoTurnoHoras?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(16)
  aumentoTurnoHoras?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5000)
  expansaoSlots?: number;

  @ApiPropertyOptional({ description: 'Investimento adicional pontual (R$) em tecnologia/expansão' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  investimentoAdicional?: number;
}
