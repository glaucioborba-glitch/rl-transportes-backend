import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsUUID } from 'class-validator';

export class CreateSaidaDto {
  @ApiProperty()
  @IsUUID()
  solicitacaoId!: string;

  @ApiProperty({ description: 'Data/hora da saída (ISO 8601)' })
  @IsDateString()
  dataHoraSaida!: string;
}
