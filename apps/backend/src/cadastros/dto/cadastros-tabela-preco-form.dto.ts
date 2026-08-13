import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';

import {

  IsArray,

  IsBoolean,

  IsDateString,

  IsIn,

  IsInt,

  IsNumber,

  IsOptional,

  IsString,

  Max,

  MaxLength,

  Min,

  MinLength,

  ValidateNested,

} from 'class-validator';



export class FaixaDiariaDto {

  @ApiProperty()

  @IsInt()

  @Min(1)

  diaInicio!: number;



  @ApiPropertyOptional({ nullable: true })

  @IsOptional()

  @IsInt()

  @Min(1)

  diaFim?: number | null;



  @ApiProperty()

  @IsNumber()

  @Min(0)

  valorDiaria!: number;

}



export class CadastrosTabelaPrecoItemDto {

  @ApiPropertyOptional({ enum: ['OPERACAO', 'ARMAZENAGEM'] })

  @IsOptional()

  @IsIn(['OPERACAO', 'ARMAZENAGEM'])

  categoriaItem?: 'OPERACAO' | 'ARMAZENAGEM';



  @ApiProperty()

  @IsString()

  @MinLength(1)

  @MaxLength(32)

  tipoOperacaoCodigo!: string;



  @ApiPropertyOptional()

  @IsOptional()

  @IsString()

  @MaxLength(32)

  tipoContainerCodigo?: string;



  @ApiPropertyOptional()

  @IsOptional()

  @IsString()

  @MaxLength(32)

  capacidadeCodigo?: string;



  @ApiPropertyOptional()

  @IsOptional()

  @IsString()

  @MaxLength(8)

  containerTamanho?: string;



  @ApiPropertyOptional({ default: 0 })

  @IsOptional()

  @IsNumber()

  valor?: number;



  @ApiPropertyOptional({ default: 'POR_OPERACAO' })

  @IsOptional()

  @IsString()

  unidade?: string;



  @ApiPropertyOptional()

  @IsOptional()

  @IsNumber()

  valorMinimo?: number;



  @ApiPropertyOptional({ enum: ['CHEIO', 'VAZIO', 'AMBOS'] })

  @IsOptional()

  @IsIn(['CHEIO', 'VAZIO', 'AMBOS'])

  statusContainer?: 'CHEIO' | 'VAZIO' | 'AMBOS';



  @ApiPropertyOptional()

  @IsOptional()

  @IsNumber()

  @Min(0)

  valorHandling?: number;



  @ApiPropertyOptional()

  @IsOptional()

  @IsInt()

  @Min(0)

  @Max(90)

  freeTimeDias?: number;



  @ApiPropertyOptional({ type: [FaixaDiariaDto] })

  @IsOptional()

  @IsArray()

  @ValidateNested({ each: true })

  @Type(() => FaixaDiariaDto)

  faixasDiaria?: FaixaDiariaDto[];



  @ApiPropertyOptional()

  @IsOptional()

  @IsNumber()

  @Min(0)

  tarifaDiariaArmazenagem?: number;



  @ApiPropertyOptional()

  @IsOptional()

  @IsNumber()

  @Min(0)

  tarifaEnergiaReeferDiaria?: number;

}



export class CadastrosTabelaPrecoFormDto {

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

  @IsString()

  clienteId?: string;



  @ApiPropertyOptional({ default: 'BRL' })

  @IsOptional()

  @IsString()

  moeda?: string;



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



  @ApiPropertyOptional({ type: [CadastrosTabelaPrecoItemDto] })

  @IsOptional()

  @IsArray()

  @ValidateNested({ each: true })

  @Type(() => CadastrosTabelaPrecoItemDto)

  itens?: CadastrosTabelaPrecoItemDto[];

}


