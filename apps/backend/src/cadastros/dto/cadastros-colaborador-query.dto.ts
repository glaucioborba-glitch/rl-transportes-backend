import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CadastrosColaboradorQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['todos', 'ativos', 'inativos', 'afastados'], default: 'ativos' })
  @IsOptional()
  @IsIn(['todos', 'ativos', 'inativos', 'afastados'])
  status?: 'todos' | 'ativos' | 'inativos' | 'afastados';

  @ApiPropertyOptional({ default: 'todos' })
  @IsOptional()
  @IsString()
  vinculo?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}
