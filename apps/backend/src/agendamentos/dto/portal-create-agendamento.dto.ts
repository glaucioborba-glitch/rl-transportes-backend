import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ModalidadeTransporte,
  StatusCarga,
  TipoOperacaoAgendamento,
  TurnoAgendamento,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/** Payload do portal cliente — `clienteId` inferido do JWT. */
export class PortalCreateAgendamentoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  solicitacaoId?: string;

  @ApiProperty({ example: 'TEMU6079348' })
  @IsString()
  @MaxLength(11)
  numeroIso!: string;

  @ApiProperty({ example: '2026-06-10' })
  @IsDateString()
  dataRef!: string;

  @ApiProperty({ enum: TurnoAgendamento })
  @IsEnum(TurnoAgendamento)
  turno!: TurnoAgendamento;

  @ApiProperty({ enum: TipoOperacaoAgendamento })
  @IsEnum(TipoOperacaoAgendamento)
  tipoOperacao!: TipoOperacaoAgendamento;

  @ApiProperty({ enum: ModalidadeTransporte, default: ModalidadeTransporte.FROTA_CLIENTE })
  @IsEnum(ModalidadeTransporte)
  modalidadeTransporte!: ModalidadeTransporte;

  @ApiProperty({ enum: StatusCarga })
  @IsEnum(StatusCarga)
  statusCarga!: StatusCarga;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  localOrigem?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  localDestino?: string;
}
