import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class TriagemReprovarDto {
  @ApiProperty({ description: 'Motivo exibido ao cliente / auditoria' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  motivo!: string;
}
