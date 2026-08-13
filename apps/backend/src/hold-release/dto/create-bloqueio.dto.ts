import { ApiProperty } from '@nestjs/swagger';
import { TipoBloqueioContainer } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateBloqueioDto {
  @ApiProperty({ enum: TipoBloqueioContainer })
  @IsEnum(TipoBloqueioContainer)
  tipo!: TipoBloqueioContainer;

  @ApiProperty({ example: 'Pendência fiscal — documentação incompleta' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motivo!: string;
}
