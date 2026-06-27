import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  StatusContainer,
  TipoCaminhao,
  TipoOperacaoSolicitacaoIntent,
  TurnoAgendamento,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  exigeTransporteClienteIntent,
} from '../solicitacao-intent.util';

export class TransporteV2Dto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  nomeMotorista!: string;

  @ApiProperty({ example: '12345678901' })
  @IsString()
  @MinLength(11)
  @MaxLength(11)
  cpfMotorista!: string;

  @ApiProperty({ enum: TipoCaminhao })
  @IsEnum(TipoCaminhao)
  tipoCaminhao!: TipoCaminhao;

  @ApiProperty()
  @IsString()
  @MinLength(7)
  @MaxLength(10)
  placaCavalo!: string;

  @ApiProperty()
  @IsString()
  @MinLength(7)
  @MaxLength(10)
  placaCarreta01!: string;

  @ApiPropertyOptional()
  @ValidateIf((o: TransporteV2Dto) => o.tipoCaminhao === TipoCaminhao.RODOTREM)
  @IsString()
  @MinLength(7)
  @MaxLength(10)
  placaCarreta02?: string;
}

export class ContainerFormDto {
  @ApiProperty()
  @IsString()
  @MaxLength(64)
  unidade!: string;

  @ApiPropertyOptional({ description: 'Opcional' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  booking?: string;

  @ApiPropertyOptional({ description: 'Opcional' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  processo?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(32)
  tamanho!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  tipo!: string;

  @ApiProperty({ enum: StatusContainer })
  @IsEnum(StatusContainer)
  status!: StatusContainer;

  @ApiPropertyOptional()
  @ValidateIf((o: ContainerFormDto) => o.status === StatusContainer.CHEIO)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  lacre?: string;

  @ApiProperty()
  @IsBoolean()
  refrigerado!: boolean;

  @ApiPropertyOptional()
  @ValidateIf((o: ContainerFormDto) => o.refrigerado === true)
  @IsNumber()
  setPoint?: number;

  @ApiProperty({ minimum: 1, maximum: 2 })
  @IsNumber()
  ordem!: number;
}

export class AgendamentoFormDto {
  @ApiProperty({ example: '2026-05-20' })
  @IsString()
  dataRef!: string;

  @ApiProperty({ enum: TurnoAgendamento })
  @IsEnum(TurnoAgendamento)
  turno!: TurnoAgendamento;

  @ApiProperty()
  @IsBoolean()
  atendimentoEspecial!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  atendimentoEspecialTexto?: string;
}

export class SolicitanteDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  nome!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  telefone!: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(255)
  email!: string;
}

export class CreateSolicitacaoV2Dto {
  @ApiProperty({ enum: TipoOperacaoSolicitacaoIntent })
  @IsEnum(TipoOperacaoSolicitacaoIntent)
  tipoOperacao!: TipoOperacaoSolicitacaoIntent;

  @ApiPropertyOptional({ description: 'Obrigatório para importação/coleta depot (Frota FL)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  localOrigem?: string;

  @ApiPropertyOptional({ description: 'Obrigatório para exportação/entrega depot (Frota FL)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  localDestino?: string;

  @ApiPropertyOptional({ type: TransporteV2Dto })
  @ValidateIf((o: CreateSolicitacaoV2Dto) => exigeTransporteClienteIntent(o.tipoOperacao))
  @ValidateNested()
  @Type(() => TransporteV2Dto)
  transporte?: TransporteV2Dto;

  @ApiProperty({ type: [ContainerFormDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContainerFormDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  containers!: ContainerFormDto[];

  @ApiProperty({ type: AgendamentoFormDto })
  @ValidateNested()
  @Type(() => AgendamentoFormDto)
  agendamento!: AgendamentoFormDto;

  @ApiProperty({ type: SolicitanteDto })
  @ValidateNested()
  @Type(() => SolicitanteDto)
  solicitante!: SolicitanteDto;

  @ApiPropertyOptional({ description: 'Import/coleta depot — previsão de retirada (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  previsaoRetirada?: string;

  @ApiPropertyOptional({ description: 'Export/entrega depot — deadline navio/booking (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  bookingDeadline?: string;
}
