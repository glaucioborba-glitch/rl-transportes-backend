import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ChaosMsDto {
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(30_000)
  ms?: number;
}
