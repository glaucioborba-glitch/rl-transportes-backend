import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CadastrosMotoristaQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['todos', 'ativos', 'inativos'], default: 'ativos' })
  @IsOptional()
  @IsIn(['todos', 'ativos', 'inativos'])
  status?: 'todos' | 'ativos' | 'inativos';

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  transportadoraId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(String(value), 10) : 1))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(String(value), 10) : undefined))
  @IsInt()
  @Min(1)
  limit?: number;
}
