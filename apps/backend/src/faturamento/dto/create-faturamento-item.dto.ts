import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsNumber, Min, MaxLength, MinLength } from 'class-validator';

export class CreateFaturamentoItemDto {
  @ApiProperty({ example: 'Armazenagem contêiner 20 pés' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  descricao!: string;

  @ApiProperty({ example: 1500.5 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Cada item deve ter valor positivo' })
  valor!: number;
}
