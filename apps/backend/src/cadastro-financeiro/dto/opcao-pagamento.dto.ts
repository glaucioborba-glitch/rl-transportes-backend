import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoOpcaoPagamento } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const MAX_PARCELAS = 12;

function parseVencimentosDto(raw: unknown): number[] | undefined {
  if (raw == null || raw === '') return undefined;
  if (typeof raw === 'number' && Number.isFinite(raw)) return [Math.floor(raw)];
  const parts = Array.isArray(raw)
    ? raw
    : String(raw).split(/[/,;]+|\s+/).map((p) => p.trim()).filter(Boolean);
  const nums = parts.map((p) => Math.floor(Number(p))).filter((n) => Number.isFinite(n));
  return nums.length ? nums : undefined;
}

export class CriarOpcaoPagamentoDto {
  @ApiProperty({ enum: TipoOpcaoPagamento })
  @IsEnum(TipoOpcaoPagamento)
  tipo!: TipoOpcaoPagamento;

  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  label!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(64)
  value?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @ApiPropertyOptional({ description: 'Primeiro vencimento (legado; use vencimentos)' })
  @IsOptional()
  @Transform(({ value }) => (value === '' || value == null ? undefined : Number(value)))
  @IsInt()
  @Min(0)
  @Max(3650)
  dias?: number;

  @ApiPropertyOptional({
    description: 'Dias de cada parcela a partir da emissão, ex.: [7, 14, 21] ou "7/14/21"',
    type: [Number],
  })
  @IsOptional()
  @Transform(({ value }) => parseVencimentosDto(value))
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(3650, { each: true })
  @ArrayMaxSize(MAX_PARCELAS)
  vencimentos?: number[];

  @ApiPropertyOptional({ description: 'Código da forma vinculada (obrigatório para PRAZO)' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  formaVinculada?: string;
}

export class AtualizarOpcaoPagamentoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === '' || value == null ? undefined : Number(value)))
  @IsInt()
  @Min(0)
  @Max(3650)
  dias?: number;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @Transform(({ value }) => parseVencimentosDto(value))
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(3650, { each: true })
  @ArrayMaxSize(MAX_PARCELAS)
  vencimentos?: number[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  formaVinculada?: string;
}
