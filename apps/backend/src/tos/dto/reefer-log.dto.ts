import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class ReeferLogDto {
  @ApiProperty({ example: -18.5, description: 'Temperatura atual em °C' })
  @IsNumber()
  temperaturaAtual!: number;
}
