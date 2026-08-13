import { ApiPropertyOptional } from '@nestjs/swagger';
import { CargoFuncionario, StatusFuncionario } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateFuncionarioDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  nome?: string;

  @ApiPropertyOptional({ enum: CargoFuncionario })
  @IsOptional()
  @IsEnum(CargoFuncionario)
  cargo?: CargoFuncionario;

  @ApiPropertyOptional({ enum: StatusFuncionario })
  @IsOptional()
  @IsEnum(StatusFuncionario)
  status?: StatusFuncionario;
}
