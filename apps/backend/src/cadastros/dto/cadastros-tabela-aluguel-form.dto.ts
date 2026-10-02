import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { FaixaDiariaDto } from './cadastros-tabela-preco-form.dto';

export class CadastrosTabelaAluguelItemFormDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  tipoContainerCodigo!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(8)
  containerTamanho!: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  valorDiaria?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  diasFreeTime?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  valorHandling?: number;

  @ApiPropertyOptional({ type: [FaixaDiariaDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FaixaDiariaDto)
  faixasDiaria?: FaixaDiariaDto[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

export class CadastrosTabelaAluguelFormDto {
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

  @ApiPropertyOptional({ type: [CadastrosTabelaAluguelItemFormDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CadastrosTabelaAluguelItemFormDto)
  itens?: CadastrosTabelaAluguelItemFormDto[];
}
