import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CargoFuncionario, StatusFuncionario } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateFuncionarioDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  nome!: string;

  @ApiProperty({ description: 'CPF (11 dígitos)' })
  @IsString()
  @MinLength(11)
  @MaxLength(14)
  cpf!: string;

  @ApiProperty({ enum: CargoFuncionario })
  @IsEnum(CargoFuncionario)
  cargo!: CargoFuncionario;

  @ApiPropertyOptional({ enum: StatusFuncionario, default: StatusFuncionario.ATIVO })
  @IsOptional()
  @IsEnum(StatusFuncionario)
  status?: StatusFuncionario;
}
