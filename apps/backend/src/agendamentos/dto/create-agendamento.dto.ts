import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ModalidadeTransporte,
  StatusAgendamentoTerminal,
  StatusCarga,
  TipoOperacaoAgendamento,
  TurnoAgendamento,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAgendamentoDto {
  @ApiProperty()
  @IsUUID()
  clienteId!: string;

  @ApiPropertyOptional({ description: 'Vínculo opcional com solicitação já existente' })
  @IsOptional()
  @IsUUID()
  solicitacaoId?: string;

  @ApiProperty({ example: 'TEMU6079348' })
  numeroIso!: string;

  @ApiProperty({ example: '2026-05-14' })
  @IsDateString()
  dataRef!: string;

  @ApiProperty({ enum: TurnoAgendamento })
  @IsEnum(TurnoAgendamento)
  turno!: TurnoAgendamento;

  @ApiPropertyOptional({ enum: StatusAgendamentoTerminal })
  @IsOptional()
  @IsEnum(StatusAgendamentoTerminal)
  status?: StatusAgendamentoTerminal;

  @ApiProperty({ enum: TipoOperacaoAgendamento, default: TipoOperacaoAgendamento.GATE_IN })
  @IsEnum(TipoOperacaoAgendamento)
  tipoOperacao!: TipoOperacaoAgendamento;

  @ApiPropertyOptional({ enum: ModalidadeTransporte, default: ModalidadeTransporte.FROTA_CLIENTE })
  @IsOptional()
  @IsEnum(ModalidadeTransporte)
  modalidadeTransporte?: ModalidadeTransporte;

  @ApiProperty({ enum: StatusCarga })
  @IsEnum(StatusCarga)
  statusCarga!: StatusCarga;

  @ApiPropertyOptional({ description: 'Obrigatório para Gate In + FROTA_FL' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  localOrigem?: string;

  @ApiPropertyOptional({ description: 'Obrigatório para Gate Out + FROTA_FL' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  localDestino?: string;

  @ApiPropertyOptional({ description: 'Valor do frete (backoffice / tabela comercial)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valorFrete?: number;
}
