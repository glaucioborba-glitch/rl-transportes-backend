import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CadastrosTabelaServicoFormDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  nome!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descricao?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  padrao?: boolean;
}

export class CadastrosServicoItemFormDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  codigo!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nome!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  valor!: number;

  @ApiPropertyOptional({ default: 'POR_UNIDADE' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  unidade?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @ApiPropertyOptional({ default: 'NENHUM' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  efeito?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  servicoLacreTerminalCodigo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  observacaoRic?: string;
}
