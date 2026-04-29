import { ApiPropertyOptional } from '@nestjs/swagger';
import { StatusSolicitacao } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

/** Query string para `GET /cliente/portal/solicitacoes` (alinhado ao portal paginado). */
export class PortalClienteSolicitacoesQueryDto {
  @ApiPropertyOptional({ description: 'Obrigatório para visão ADMIN/GERENTE (staff)' })
  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ enum: StatusSolicitacao })
  @IsOptional()
  @IsEnum(StatusSolicitacao)
  status?: StatusSolicitacao;

  @ApiPropertyOptional({ description: 'ISO 8601 — createdAt >=' })
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @ApiPropertyOptional({ description: 'ISO 8601 — createdAt <=' })
  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @ApiPropertyOptional({ description: 'Contém no protocolo (sem distinção de maiúsculas)' })
  @IsOptional()
  @IsString()
  protocolo?: string;

  @ApiPropertyOptional({
    enum: ['createdAt', 'updatedAt', 'protocolo', 'status'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'protocolo', 'status'])
  orderBy?: 'createdAt' | 'updatedAt' | 'protocolo' | 'status' = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';
}
