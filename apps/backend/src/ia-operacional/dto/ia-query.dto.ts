import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoUnidade } from '@prisma/client';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MinLength,
} from 'class-validator';
import { TurnoIa } from './ia-turno.enum';

export class IaCicloPrevistoQueryDto {
  @ApiProperty({ enum: TipoUnidade })
  @Matches(/^(IMPORT|EXPORT|GATE_IN|GATE_OUT)$/, { message: 'tipoUnidade inválido' })
  tipoUnidade!: TipoUnidade;

  @ApiPropertyOptional({ description: 'Filtra histórico por cliente' })
  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @ApiProperty({
    description:
      'Instante previsto de chegada à portaria (ISO 8601). Usado para fator de horário/pico.',
    example: '2026-04-28T10:00:00.000Z',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(16)
  horarioChegada!: string;
}

export class IaProdutividadeOperadorQueryDto {
  @ApiProperty({ enum: TurnoIa })
  @Matches(/^(MANHA|TARDE|NOITE)$/, { message: 'turno inválido' })
  turno!: TurnoIa;

  @ApiPropertyOptional({ description: 'Filtra auditoria por usuário (id interno)' })
  @IsOptional()
  @IsUUID()
  operadorId?: string;
}

/** Body JSON para POST /ia/ocr/gate (upload multipart: POST /ia/ocr/gate/upload). */
export class IaOcrGateBodyDto {
  @ApiProperty({
    description:
      'PNG/JPEG em base64 (sem prefixo) ou data URL `data:image/jpeg;base64,...`',
  })
  @IsString()
  @IsNotEmpty()
  imagemBase64!: string;
}
