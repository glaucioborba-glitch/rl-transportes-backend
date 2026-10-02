import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignDispatchDto {
  @ApiProperty()
  @IsUUID()
  agendamentoId!: string;

  @ApiProperty()
  @IsUUID()
  motoristaId!: string;

  @ApiProperty()
  @IsUUID()
  veiculoId!: string;
}
