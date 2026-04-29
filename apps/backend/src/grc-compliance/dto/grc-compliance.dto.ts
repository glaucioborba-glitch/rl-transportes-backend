import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const CAT = ['operacional', 'financeiro', 'seguranca', 'fiscal', 'ambiental'] as const;
const STAT_R = ['aberto', 'mitigando', 'controlado'] as const;
const ORIG = ['auditoria', 'operacao', 'fiscal', 'financeiro', 'seguranca_patrimonial'] as const;
const FREQ = ['continuo', 'diario', 'semanal', 'mensal'] as const;
const STAT_P = ['aberto', 'em_andamento', 'concluido'] as const;

export class CreateRiscoGrcDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  titulo!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  descricao!: string;

  @ApiProperty({ enum: CAT })
  @IsIn([...CAT])
  categoria!: (typeof CAT)[number];

  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  probabilidade!: number;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  impacto!: number;

  @ApiProperty({ enum: STAT_R })
  @IsIn([...STAT_R])
  status!: (typeof STAT_R)[number];

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  responsavel!: string;

  @ApiProperty({ enum: ORIG })
  @IsIn([...ORIG])
  origem!: (typeof ORIG)[number];
}

export class CreateControleGrcDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  nomeControle!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  riscoRelacionadoId!: string;

  @ApiProperty({ enum: FREQ })
  @IsIn([...FREQ])
  frequencia!: (typeof FREQ)[number];

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  responsavel!: string;

  @ApiPropertyOptional({ description: 'Metadado textual de evidência (sem upload nesta fase)' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  evidencia?: string;

  @ApiProperty({ minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  eficacia!: number;
}

export class CreatePlanoAcaoGrcDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  what!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  why!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  where!: string;

  @ApiProperty({ description: 'ISO date ou texto de prazo' })
  @IsString()
  @IsNotEmpty()
  when!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  who!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  how!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  howMuch!: number;

  @ApiProperty({ enum: STAT_P })
  @IsIn([...STAT_P])
  status!: (typeof STAT_P)[number];
}
