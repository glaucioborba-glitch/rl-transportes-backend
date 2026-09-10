import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StatusCarga, StatusFrete, TipoFrete, TurnoAgendamento } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateFreteDto {
  @ApiProperty({ example: '2026-09-03' })
  @IsDateString()
  dataRef!: string;

  @ApiPropertyOptional({ example: '08x09' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  janela?: string;

  @ApiPropertyOptional({ enum: TurnoAgendamento })
  @IsOptional()
  @IsEnum(TurnoAgendamento)
  turno?: TurnoAgendamento;

  @ApiProperty({ example: 'TGBU6084982' })
  @IsString()
  @MaxLength(16)
  numeroIso!: string;

  @ApiProperty({ enum: StatusCarga })
  @IsEnum(StatusCarga)
  statusCarga!: StatusCarga;

  @ApiProperty({ enum: TipoFrete })
  @IsEnum(TipoFrete)
  tipo!: TipoFrete;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  local?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  clienteNome!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  motoristaNome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(14)
  cpfMotorista?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  placaCavalo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  placaCarreta?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valor?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  booking?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacao?: string;

  @ApiPropertyOptional({ enum: StatusFrete })
  @IsOptional()
  @IsEnum(StatusFrete)
  status?: StatusFrete;
}

export class UpdateFreteDto {
  @ApiPropertyOptional({ example: '2026-09-03' })
  @IsOptional()
  @IsDateString()
  dataRef?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(16)
  janela?: string | null;

  @ApiPropertyOptional({ enum: TurnoAgendamento })
  @IsOptional()
  @IsEnum(TurnoAgendamento)
  turno?: TurnoAgendamento | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(16)
  numeroIso?: string;

  @ApiPropertyOptional({ enum: StatusCarga })
  @IsOptional()
  @IsEnum(StatusCarga)
  statusCarga?: StatusCarga;

  @ApiPropertyOptional({ enum: TipoFrete })
  @IsOptional()
  @IsEnum(TipoFrete)
  tipo?: TipoFrete;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  local?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  clienteNome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  motoristaNome?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(14)
  cpfMotorista?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  placaCavalo?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  placaCarreta?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valor?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  booking?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacao?: string | null;

  @ApiPropertyOptional({ enum: StatusFrete })
  @IsOptional()
  @IsEnum(StatusFrete)
  status?: StatusFrete;
}
