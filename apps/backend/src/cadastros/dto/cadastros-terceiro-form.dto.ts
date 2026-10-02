import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CapacidadeVeiculoTerceiro } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CadastrosTerceiroCarretaDto {
  @ApiProperty()
  @IsString()
  @MaxLength(10)
  placa!: string;

  @ApiPropertyOptional({ enum: CapacidadeVeiculoTerceiro })
  @IsOptional()
  @IsEnum(CapacidadeVeiculoTerceiro)
  capacidade?: CapacidadeVeiculoTerceiro;

  @ApiPropertyOptional({ type: [String], description: 'Tamanhos/pinos do cadastro tipos-container (20, 40, 45)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pinos?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(14)
  renavam?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' && !value.trim() ? undefined : value))
  @IsDateString()
  validadeDocumento?: string | null;
}

export class CadastrosTerceiroFormDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  motoristaNome!: string;

  @ApiProperty({ description: 'CPF do motorista (com ou sem máscara)' })
  @IsString()
  @MinLength(11)
  @MaxLength(14)
  motoristaCpf!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(255)
  donoNome?: string | null;

  @ApiPropertyOptional({ description: 'Chave PIX do dono do caminhão' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(128)
  pix?: string | null;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  @MaxLength(10)
  placaCavalo!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  placaCarreta?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  placaCarreta02?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(14)
  renavamCavalo?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' && !value.trim() ? undefined : value))
  @IsDateString()
  crlvValidadeCavalo?: string | null;

  @ApiPropertyOptional({ type: [String], description: 'Todas as carretas do dono (ordem)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  placasCarretas?: string[];

  @ApiPropertyOptional({ type: [CadastrosTerceiroCarretaDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CadastrosTerceiroCarretaDto)
  carretas?: CadastrosTerceiroCarretaDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8)
  cnhCategoria?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' && !value.trim() ? undefined : value))
  @IsDateString()
  cnhValidade?: string | null;

  @ApiPropertyOptional({ description: 'Celular WhatsApp do motorista (com ou sem máscara)' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(20)
  whatsapp?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documentoIds?: string[];

  @ApiPropertyOptional({ enum: CapacidadeVeiculoTerceiro })
  @IsOptional()
  @IsEnum(CapacidadeVeiculoTerceiro)
  capacidade?: CapacidadeVeiculoTerceiro;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
