import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class SimularEncargosDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  competencia?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dataInicio?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dataFim?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1_000_000_000)
  receitaManual?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  salvar?: boolean;
}
