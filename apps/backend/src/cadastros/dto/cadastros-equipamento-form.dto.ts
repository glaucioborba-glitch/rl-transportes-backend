import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CadastrosEquipamentoFormDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  codigo!: string;

  @ApiProperty()
  @IsIn([
    'EMPILHADEIRA_FRONTAL',
    'REACH_STACKER',
    'RTG',
    'GUINDASTE_MOBILE',
    'EMPILHADEIRA_LATERAL',
  ])
  tipo!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  marca?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  modelo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  capacidade?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  alturaMaxima?: string;

  @ApiPropertyOptional({ default: 'DISPONIVEL' })
  @IsOptional()
  @IsIn(['DISPONIVEL', 'EM_USO', 'EM_MANUTENCAO', 'INATIVO'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  horimetro?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  ultimaManutencao?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  proximaManutencao?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  centroCusto?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observacoes?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

export class VincularEquipamentoDto {
  @ApiProperty()
  @IsUUID()
  equipamentoId!: string;
}
