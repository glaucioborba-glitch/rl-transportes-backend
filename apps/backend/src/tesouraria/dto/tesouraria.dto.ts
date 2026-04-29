import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

const CATEGORIAS_DESPESA = [
  'OPEX',
  'CAPEX',
  'IMPOSTOS',
  'MANUTENCAO',
  'SERVICOS',
  'TI',
  'FROTA',
] as const;

const STATUS_DESPESA = ['pendente', 'pago', 'atrasado'] as const;

const RECORRENCIA = ['nenhuma', 'mensal', 'anual'] as const;

const CATEG_FORN = ['energia', 'TI', 'manutencao', 'seguranca', 'transporte', 'geral'] as const;

const TIPO_CONTRATO = ['mensal', 'anual', 'SLA', 'servico'] as const;

export class CreateDespesaDto {
  @ApiProperty({ example: 'Fornecedor XYZ Ltda' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  fornecedor!: string;

  @ApiProperty({ enum: CATEGORIAS_DESPESA })
  @IsIn([...CATEGORIAS_DESPESA])
  categoria!: (typeof CATEGORIAS_DESPESA)[number];

  @ApiProperty({ example: 'Serviço de internet dedicada' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  descricao!: string;

  @ApiProperty({ example: 2500.5 })
  @IsNumber()
  @Min(0)
  valor!: number;

  @ApiProperty({ example: '2026-05-10', description: 'Data de vencimento (YYYY-MM-DD)' })
  @IsString()
  @IsNotEmpty()
  vencimento!: string;

  @ApiPropertyOptional({ enum: STATUS_DESPESA, default: 'pendente' })
  @IsOptional()
  @IsIn([...STATUS_DESPESA])
  status?: (typeof STATUS_DESPESA)[number];

  @ApiPropertyOptional({ enum: RECORRENCIA, default: 'nenhuma' })
  @IsOptional()
  @IsIn([...RECORRENCIA])
  recorrencia?: (typeof RECORRENCIA)[number];

  @ApiPropertyOptional({ example: 'NF 12345' })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  documentoReferencia?: string;
}

export class CreateFornecedorDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  nome!: string;

  @ApiProperty({ example: '12345678000199' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(18)
  cnpj!: string;

  @ApiProperty({ enum: CATEG_FORN })
  @IsIn([...CATEG_FORN])
  categoriaFornecedor!: (typeof CATEG_FORN)[number];

  @ApiProperty({ example: 'contato@fornecedor.com.br' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  contato!: string;

  @ApiProperty({ description: 'Prazo padrão em dias', example: 30 })
  @IsNumber()
  @Min(0)
  prazoPagamentoPadrao!: number;
}

export class CreateContratoDto {
  @ApiProperty({ description: 'ID do fornecedor cadastrado em memória' })
  @IsString()
  @IsNotEmpty()
  fornecedorId!: string;

  @ApiProperty({ enum: TIPO_CONTRATO })
  @IsIn([...TIPO_CONTRATO])
  tipoContrato!: (typeof TIPO_CONTRATO)[number];

  @ApiProperty()
  @IsNumber()
  @Min(0)
  valorFixo!: number;

  @ApiProperty({ example: '2026-01-01' })
  @IsString()
  @IsNotEmpty()
  vigenciaInicio!: string;

  @ApiProperty({ example: '2027-12-31' })
  @IsString()
  @IsNotEmpty()
  vigenciaFim!: string;

  @ApiProperty({ description: 'Percentual anual de reajuste (pode ser 0)', example: 4.5 })
  @IsNumber()
  reajusteAnualPct!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  observacoes?: string;
}
