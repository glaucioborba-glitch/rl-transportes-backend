import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StatusContainer } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
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
  AgendamentoFormDto,
  SolicitanteDto,
  TransporteV2Dto,
} from '../../modules/solicitacoes-v2/dto/create-solicitacao-v2.dto';

export class UpdatePortalContainerDto {
  @ApiPropertyOptional({ description: 'Ignorado/bloqueado pelo backend' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  unidade?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  booking?: string;

  @ApiPropertyOptional()
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
  @ValidateIf((o: UpdatePortalContainerDto) => o.status === StatusContainer.CHEIO)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  lacre?: string;

  @ApiProperty()
  @IsBoolean()
  refrigerado!: boolean;

  @ApiPropertyOptional()
  @ValidateIf((o: UpdatePortalContainerDto) => o.refrigerado === true)
  @IsNumber()
  setPoint?: number;

  @ApiProperty({ minimum: 1, maximum: 2 })
  @IsNumber()
  ordem!: number;
}

export class UpdatePortalSolicitacaoDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => TransporteV2Dto)
  transporte?: TransporteV2Dto;

  @ApiProperty({ type: [UpdatePortalContainerDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => UpdatePortalContainerDto)
  containers!: UpdatePortalContainerDto[];

  @ApiProperty()
  @ValidateNested()
  @Type(() => AgendamentoFormDto)
  agendamento!: AgendamentoFormDto;

  @ApiProperty()
  @ValidateNested()
  @Type(() => SolicitanteDto)
  solicitante!: SolicitanteDto;
}
