import { ApiProperty } from '@nestjs/swagger';
import { StatusSolicitacao } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdateSolicitacaoDto {
  @ApiProperty({ enum: StatusSolicitacao, required: false })
  @IsOptional()
  @IsEnum(StatusSolicitacao)
  status?: StatusSolicitacao;
}
