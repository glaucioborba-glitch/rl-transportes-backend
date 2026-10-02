import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ChaosTurbulenciaDto {
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(30_000)
  durationMs?: number;
}
