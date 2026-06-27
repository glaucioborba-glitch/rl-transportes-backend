import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class EscolherPessoaDto {
  @ApiProperty({ description: 'ID da pessoa autorizada selecionada' })
  @IsUUID()
  pessoaId!: string;
}
