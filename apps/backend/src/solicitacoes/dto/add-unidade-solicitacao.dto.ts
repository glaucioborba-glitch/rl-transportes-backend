import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { CreateUnidadeDto } from './create-unidade.dto';

/** Adiciona um container ISO a uma solicitação existente (PDF Semana 2). */
export class AddUnidadeSolicitacaoDto extends CreateUnidadeDto {
  @ApiProperty()
  @IsUUID()
  solicitacaoId!: string;
}
