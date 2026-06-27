import { IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class ChaosBloqueioDto {
  @IsString()
  @MinLength(2)
  pathPrefix!: string;

  @IsIn([503, 504])
  status!: 503 | 504;

  @IsOptional()
  @IsInt()
  @Min(500)
  @Max(30_000)
  durationMs?: number;
}
