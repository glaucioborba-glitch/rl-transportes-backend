import { ApiPropertyOptional } from '@nestjs/swagger';
import { StatusSolicitacao } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class PaginationDto {
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

  @ApiPropertyOptional({ default: 'createdAt' })
  @IsOptional()
  @IsString()
  orderBy?: string = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';
}

/** Paginação para listagem de clientes (whitelist de ordenação). */
export class ClientePaginationDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filtro texto em nome, e-mail ou documento' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['createdAt', 'nome', 'email'], default: 'createdAt' })
  @IsOptional()
  @IsIn(['createdAt', 'nome', 'email'])
  override orderBy?: 'createdAt' | 'nome' | 'email' = 'createdAt';
}

/** Paginação para solicitações. */
export class SolicitacaoPaginationDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @ApiPropertyOptional({ enum: StatusSolicitacao })
  @IsOptional()
  @IsEnum(StatusSolicitacao)
  status?: StatusSolicitacao;

  @ApiPropertyOptional({ enum: ['createdAt', 'protocolo', 'status'], default: 'createdAt' })
  @IsOptional()
  @IsIn(['createdAt', 'protocolo', 'status'])
  override orderBy?: 'createdAt' | 'protocolo' | 'status' = 'createdAt';
}
