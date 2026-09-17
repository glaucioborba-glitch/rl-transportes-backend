import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { CreateSolicitacaoV2Dto } from './create-solicitacao-v2.dto';

export class CreateSolicitacaoV2StaffDto extends CreateSolicitacaoV2Dto {
  @ApiProperty({ description: 'Cliente titular da solicitação (preenchimento manual no Gate)' })
  @IsUUID()
  clienteId!: string;
}
