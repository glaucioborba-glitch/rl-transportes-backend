import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PatioSaldoQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(['TODOS', 'REEFER', 'DRY'])
  tipo?: 'TODOS' | 'REEFER' | 'DRY';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3650)
  diasMin?: number;

  @IsOptional()
  @IsIn(['TODOS', 'CHEIO', 'VAZIO'])
  situacao?: 'TODOS' | 'CHEIO' | 'VAZIO';

  @IsOptional()
  @IsIn(['TODOS', '20', '40', '45'])
  tamanho?: 'TODOS' | '20' | '40' | '45';

  /** TODAS | SEM | COM | código da baia */
  @IsOptional()
  @IsString()
  baia?: string;

  @IsOptional()
  @IsString()
  cliente?: string;
}
