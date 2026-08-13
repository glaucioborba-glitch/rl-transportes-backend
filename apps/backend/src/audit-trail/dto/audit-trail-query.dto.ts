import { CategoriaAuditLog } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class AuditTrailQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(CategoriaAuditLog)
  categoria?: CategoriaAuditLog;

  @IsOptional()
  @IsString()
  usuarioId?: string;

  @IsOptional()
  @IsString()
  acao?: string;

  @IsOptional()
  @IsString()
  containerIso?: string;

  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 30;
}

export class AuditTrailExportQueryDto extends AuditTrailQueryDto {
  @IsOptional()
  @IsString()
  format?: 'csv' | 'xlsx';
}
