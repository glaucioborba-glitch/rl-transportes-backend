import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePessoaAutorizadaDto {
  @ApiPropertyOptional({ description: 'Ativar ou desativar pessoa autorizada' })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
