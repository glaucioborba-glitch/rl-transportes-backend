import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CadastrosClienteQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['todos', 'ativos', 'inativos'], default: 'ativos' })
  @IsOptional()
  @IsIn(['todos', 'ativos', 'inativos'])
  status?: 'todos' | 'ativos' | 'inativos';

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}
