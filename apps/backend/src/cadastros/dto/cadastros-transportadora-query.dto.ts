import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CadastrosTransportadoraQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['todos', 'ativas', 'inativas'], default: 'ativas' })
  @IsOptional()
  @IsIn(['todos', 'ativas', 'inativas'])
  status?: 'todos' | 'ativas' | 'inativas';

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
