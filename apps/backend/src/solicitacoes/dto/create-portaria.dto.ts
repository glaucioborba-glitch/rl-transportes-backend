import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MinLength } from 'class-validator';

export class CreatePortariaDto {
  @ApiProperty()
  @IsUUID()
  solicitacaoId!: string;

  @ApiProperty({ example: 'ABCD-1D34', description: 'Placa Mercosul (com ou sem hífen)' })
  @IsString()
  @MinLength(7)
  placa!: string;
}
