import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CadastrosPosicaoPatioFormDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  zonaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @MaxLength(16)
  zonaCodigo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  zonaNome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(16)
  zonaCor?: string;

  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  baiaCodigo!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  slotNumero!: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(6)
  stackAltura?: number;

  @ApiPropertyOptional({ default: 'MISTO' })
  @IsOptional()
  @IsString()
  tipoAceito?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  tomadaReefer?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  capacidadePeso?: number;

  @ApiPropertyOptional({ default: 'LIVRE' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  restricoes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(11)
  containerAtual?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

export class CadastrosPosicaoPatioDisponiveisQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tipo?: string;
}
