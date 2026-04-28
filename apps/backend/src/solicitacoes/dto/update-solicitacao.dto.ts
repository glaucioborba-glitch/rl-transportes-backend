import { ApiPropertyOptional } from '@nestjs/swagger';
import { StatusSolicitacao } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdateSolicitacaoDto {
  @ApiPropertyOptional({ enum: StatusSolicitacao })
  @IsOptional()
  @IsEnum(StatusSolicitacao)
  status?: StatusSolicitacao;
}
