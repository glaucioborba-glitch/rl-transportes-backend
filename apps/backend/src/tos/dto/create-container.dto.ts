import { ApiProperty } from '@nestjs/swagger';
import { TipoContainerTos } from '@prisma/client';
import { IsEnum, IsUUID, Matches, MaxLength } from 'class-validator';

export class CreateContainerDto {
  @ApiProperty({ example: 'ABCD1234567', description: 'ISO 6346: 4 letras + 7 dígitos' })
  @Matches(/^[A-Za-z]{4}\d{7}$/, { message: 'numero deve ser sigla (4 letras) + 7 dígitos' })
  @MaxLength(11)
  numero!: string;

  @ApiProperty({ enum: TipoContainerTos })
  @IsEnum(TipoContainerTos)
  tipo!: TipoContainerTos;

  @ApiProperty()
  @IsUUID()
  clienteId!: string;

  @ApiProperty({ description: 'ID do agendamento terminal (QR Code)' })
  @IsUUID()
  agendamentoId!: string;
}
