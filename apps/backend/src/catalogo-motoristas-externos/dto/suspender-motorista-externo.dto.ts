import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class SuspenderMotoristaExternoDto {
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  indefinido?: boolean;

  @ValidateIf((o: SuspenderMotoristaExternoDto) => !o.indefinido)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  dias?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data de início inválida.' })
  inicio?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  motivo!: string;

  @IsString()
  @MinLength(5)
  documento!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
