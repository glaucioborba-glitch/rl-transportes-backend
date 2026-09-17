import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, Max, Min } from 'class-validator';

export class PixCreditoContaCorrenteDto {
  @ApiProperty({ example: 150.5, description: 'Valor em reais a creditar na conta corrente' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9_999_999.99)
  valor!: number;
}
