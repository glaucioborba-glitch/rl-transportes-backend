import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { AlertaTipo, LogSeveridade } from '../observabilidade.types';

const TIPOS: AlertaTipo[] = [
  'degradacao_rota',
  'latencia_alta',
  'erro_operacional',
  'excecao_critica',
];
const SEV: LogSeveridade[] = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];

export class CreateObservabilidadeAlertaDto {
  @ApiProperty({ enum: TIPOS })
  @IsIn(TIPOS)
  tipo!: AlertaTipo;

  @ApiProperty({ enum: SEV })
  @IsIn(SEV)
  severidade!: LogSeveridade;

  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  mensagem!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  requestId?: string;

  @ApiPropertyOptional({ description: 'Metadados não sensíveis (JSON objeto)' })
  @IsOptional()
  metadata?: Record<string, unknown>;
}
