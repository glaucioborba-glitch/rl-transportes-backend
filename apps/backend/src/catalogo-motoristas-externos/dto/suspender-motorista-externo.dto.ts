import { Type } from 'class-transformer';
import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class SuspenderMotoristaExternoDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  dias!: number;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  motivo!: string;
}
