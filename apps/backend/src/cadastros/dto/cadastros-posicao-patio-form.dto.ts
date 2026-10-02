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

  @ApiPropertyOptional({ description: 'Legado — a baia deixa de existir; zona + posição bastam.' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @MaxLength(32)
  baiaCodigo?: string;

  @ApiPropertyOptional({ description: '1 a 12. Preferir o campo posicao.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  slotNumero?: number;

  @ApiProperty({ example: 5, description: 'Posição na zona (1 a 12, grade 4×3)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  posicao?: number;

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

export class CadastrosZonaPatioFormDto {
  @ApiProperty({ example: 'A1' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @MaxLength(16)
  codigo!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  nome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(16)
  cor?: string;

  @ApiPropertyOptional({ default: true, deprecated: true })
  @IsOptional()
  @IsBoolean()
  gerarPosicoes?: boolean;

  @ApiPropertyOptional({
    example: 12,
    description: 'Quantidade de posições a criar na grade (1–12). 0 = só a zona.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(12)
  quantidadePosicoes?: number;
}

export class CadastrosPosicaoPatioDisponiveisQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tipo?: string;
}
