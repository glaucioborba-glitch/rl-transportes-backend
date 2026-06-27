import { ApiPropertyOptional } from '@nestjs/swagger';
import { StatusSolicitacao } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class ListSolicitacoesV2QueryDto {
  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ enum: StatusSolicitacao })
  @IsOptional()
  @IsEnum(StatusSolicitacao)
  status?: StatusSolicitacao;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  clienteId?: string;
}
