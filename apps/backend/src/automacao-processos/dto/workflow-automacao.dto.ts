import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  Allow,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import type { WorkflowAcao, WorkflowCondicao } from '../automacao.types';

export class WorkflowCondicaoDto implements WorkflowCondicao {
  @ApiProperty({ example: 'container.tipo' })
  @IsString()
  campo: string;

  @ApiProperty({ enum: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'contains'] })
  @IsString()
  @IsIn(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'contains'])
  op: WorkflowCondicao['op'];

  @ApiProperty({ example: 'reefer' })
  @Allow()
  valor: unknown;
}

export class WorkflowAcaoDto implements WorkflowAcao {
  @ApiProperty({
    example: 'emitir_alerta',
    enum: [
      'criar_faturamento_simulado',
      'enviar_webhook',
      'emitir_alerta',
      'gerar_os_simulada',
      'anexar_auditoria',
      'atualizar_status_operacional_simulado',
      'sugerir_nfse',
      'disparar_workflow',
      'log_destino_modulo',
    ],
  })
  @IsString()
  tipo: WorkflowAcao['tipo'];

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  params?: Record<string, unknown>;
}

export class CriarWorkflowDto {
  @ApiPropertyOptional({ description: 'Se informado, atualiza o workflow existente (upsert).' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ example: 'Alerta Reefer Gate' })
  @IsString()
  nome: string;

  @ApiProperty({ example: 'gate.registrado', description: 'Mesmos identificadores do integrador (Fase 14).' })
  @IsString()
  eventoDisparo: string;

  @ApiProperty({ type: [WorkflowCondicaoDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowCondicaoDto)
  condicoes: WorkflowCondicaoDto[];

  @ApiProperty({ type: [WorkflowAcaoDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowAcaoDto)
  acoes: WorkflowAcaoDto[];

  @ApiProperty({ minimum: 1, maximum: 5, example: 2 })
  @IsInt()
  @Min(1)
  @Max(5)
  prioridade: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

export class AtualizarWorkflowAtivoDto {
  @ApiProperty()
  @IsBoolean()
  ativo: boolean;
}

export class TestarWorkflowDto {
  @ApiProperty({ example: 'gate.registrado' })
  @IsString()
  eventoDisparo: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  payload: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Workflow efêmero (não persistido) para simulação.' })
  @IsOptional()
  @ValidateNested()
  @Type(() => CriarWorkflowDto)
  rascunho?: CriarWorkflowDto;
}

/** Modelo interno de evento (bridge Fase 14 → 19). */
export class AutomacaoEventoInternoDocDto {
  @ApiProperty({ example: 'gate.registrado' })
  tipo: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  payload: Record<string, unknown>;

  @ApiPropertyOptional()
  clienteId?: string;

  @ApiPropertyOptional()
  correlationId?: string;
}
