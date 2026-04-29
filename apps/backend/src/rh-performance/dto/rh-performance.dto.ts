import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Max,
  Min,
} from 'class-validator';

const TURNOS = ['MANHA', 'TARDE', 'NOITE'] as const;
const ESCOPO_OKR = ['corporativo', 'setorial', 'individual'] as const;
const STATUS_TR = ['pendente', 'concluido'] as const;

export class CreateAvaliacaoRhDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  colaboradorId!: string;

  @ApiPropertyOptional({
    enum: TURNOS,
    description: 'Opcional — melhora KPIs por turno sem ler folha-rh.',
  })
  @IsOptional()
  @IsIn([...TURNOS])
  turnoReferencia?: (typeof TURNOS)[number];

  @ApiPropertyOptional({ example: 'Motorista' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  cargoReferencia?: string;

  @ApiProperty({ example: '2026-04' })
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  periodo!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  avaliador!: string;

  @ApiProperty({ minimum: 0, maximum: 10 })
  @IsNumber()
  @Min(0)
  @Max(10)
  notaTecnica!: number;

  @ApiProperty({ minimum: 0, maximum: 10 })
  @IsNumber()
  @Min(0)
  @Max(10)
  notaComportamental!: number;

  @ApiProperty({ minimum: 0, maximum: 10 })
  @IsNumber()
  @Min(0)
  @Max(10)
  aderenciaProcedimentos!: number;

  @ApiProperty({ minimum: 0, maximum: 10 })
  @IsNumber()
  @Min(0)
  @Max(10)
  qualidadeExecucao!: number;

  @ApiProperty({ minimum: 0, maximum: 10 })
  @IsNumber()
  @Min(0)
  @Max(10)
  comprometimento!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  comentarioGerencial?: string;
}

export class CreateOkrRhDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  objetivo!: string;

  @ApiProperty({ enum: ESCOPO_OKR })
  @IsIn([...ESCOPO_OKR])
  escopo!: (typeof ESCOPO_OKR)[number];

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(32)
  @IsString({ each: true })
  keyResults!: string[];

  @ApiProperty({ minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  progressoAtual!: number;

  @ApiProperty({ example: '2026-01-01' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  periodoInicio!: string;

  @ApiProperty({ example: '2026-06-30' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  periodoFim!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  responsavel!: string;
}

export class CreateTreinamentoRhDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  colaboradorId!: string;

  @ApiProperty({ example: 'seguranca_nr' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  modulo!: string;

  @ApiProperty({ example: 8 })
  @IsNumber()
  @Min(0)
  cargaHoraria!: number;

  @ApiProperty({ enum: STATUS_TR })
  @IsIn([...STATUS_TR])
  status!: (typeof STATUS_TR)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dataConclusao?: string;
}
