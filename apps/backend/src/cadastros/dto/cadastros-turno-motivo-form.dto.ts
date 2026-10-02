import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CadastrosTurnoFormDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(16)
  codigo!: string;

  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nome!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(8)
  horaInicio!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(8)
  horaFim!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  capacidadeMaxima?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  diasSemana?: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

export class CadastrosMotivoRejeicaoFormDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  codigo!: string;

  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  descricao!: string;

  @ApiPropertyOptional({ default: 'REJEICAO_GATE' })
  @IsOptional()
  @IsString()
  tipo?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  exigeObservacao?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  notificaCliente?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

export class CadastrosMotivoRejeicaoQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tipo?: string;
}
