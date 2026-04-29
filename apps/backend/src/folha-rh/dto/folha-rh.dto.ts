import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

const TURNOS = ['MANHA', 'TARDE', 'NOITE'] as const;
const TIPO_CONTR = ['CLT', 'TEMPORARIO', 'TERCEIRO'] as const;
const TIPO_BEN = ['fixo', 'percentual', 'coparticipacao'] as const;

export class CreateColaboradorRhDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  nome!: string;

  @ApiProperty({ example: '12345678901' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(14)
  cpf!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  cargo!: string;

  @ApiProperty({ enum: TURNOS })
  @IsIn([...TURNOS])
  turno!: (typeof TURNOS)[number];

  @ApiProperty()
  @IsNumber()
  @Min(0)
  salarioBase!: number;

  @ApiProperty({ enum: TIPO_CONTR })
  @IsIn([...TIPO_CONTR])
  tipoContratacao!: (typeof TIPO_CONTR)[number];

  @ApiProperty({ example: '2024-03-01' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dataAdmissao!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dataDemissao?: string;

  @ApiPropertyOptional({
    description: 'Nomes que batam com cadastro de benefícios (case-insensitive)',
    example: ['VR', 'VT'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(64)
  @IsString({ each: true })
  beneficiosAtivos?: string[];
}

export class CreateBeneficioRhDto {
  @ApiProperty({ example: 'VR' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  nomeBeneficio!: string;

  @ApiProperty({ description: 'Para percentual: número do percentual (ex.: 6 para 6%)' })
  @IsNumber()
  @Min(0)
  valorMensal!: number;

  @ApiProperty({ enum: TIPO_BEN })
  @IsIn([...TIPO_BEN])
  tipoBeneficio!: (typeof TIPO_BEN)[number];
}

export class CreatePresencaRhDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  colaboradorId!: string;

  @ApiProperty({ example: '2026-04-28' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  data!: string;

  @ApiProperty({ example: 8 })
  @IsNumber()
  @Min(0)
  horasTrabalhadas!: number;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @Min(0)
  horasExtras!: number;

  @ApiProperty({ example: 0 })
  @IsNumber()
  @Min(0)
  adicionalNoturnoHoras!: number;

  @ApiProperty()
  @IsBoolean()
  falta!: boolean;
}

export class MesReferenciaQueryDto {
  @ApiProperty({ example: '2026-04', description: 'Competência YYYY-MM' })
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  mes!: string;
}
