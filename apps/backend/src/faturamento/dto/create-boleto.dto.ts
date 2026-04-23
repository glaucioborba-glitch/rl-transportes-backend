import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateBoletoDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  numeroBoleto!: string;

  @ApiProperty()
  @IsDateString()
  dataVencimento!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  valorBoleto!: number;
}
