import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { FeriadoMunicipalDto } from './feriado-municipal.dto';

export class UpdateTurnoOperacionalDto {
  @IsString()
  id!: string;

  @IsString()
  @MaxLength(32)
  codigo!: string;

  @IsIn(['MANHA', 'TARDE'])
  slot!: 'MANHA' | 'TARDE';

  @IsString()
  @MaxLength(64)
  nome!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  horaInicio!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  horaFim!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(500)
  capacidadeMaxima!: number;

  @IsArray()
  @IsString({ each: true })
  diasSemana!: string[];

  @IsBoolean()
  ativo!: boolean;
}

export class UpdateToleranciaChegadaDto {
  @IsIn(['dia', 'turno', 'horario'])
  tipo!: 'dia' | 'turno' | 'horario';

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10080)
  valorMin!: number;

  @IsBoolean()
  ativo!: boolean;
}

export class UpdateOperacionalDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5000)
  capacidadeTotalSlots?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(2000)
  teuMaximoSimultaneo?: number;
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  horarioFuncionamentoInicio?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  horarioFuncionamentoFim?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(90)
  freeTimePadraoDias?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(4320)
  tatAlvoEntradaMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(4320)
  tatAlvoSaidaMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(4320)
  tatAlvoRemocaoMin?: number;

  /** @deprecated use tatAlvoEntradaMin */
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(72)
  tatAlvoBaixaHoras?: number;

  /** @deprecated use tatAlvoSaidaMin */
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(72)
  tatAlvoColetaHoras?: number;

  /** @deprecated use tatAlvoRemocaoMin */
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(72)
  tatAlvoTransferenciaHoras?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limiteAgendamentosPorTurno?: number;
  @IsOptional()
  @IsBoolean()
  operacaoFimSemana?: boolean;

  /** Texto explicativo exibido na UI (fim de semana / cobrança). */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descricaoFimSemana?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateToleranciaChegadaDto)
  toleranciaChegada?: UpdateToleranciaChegadaDto;

  /** @deprecated use toleranciaChegada */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(180)
  tempoToleranciaChegadaMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10080)
  antecedenciaMinimaMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10080)
  cancelamentoSemPenalidadeMin?: number;

  @IsOptional()
  @IsBoolean()
  validarAntecedenciaAgendamento?: boolean;

  @IsOptional()
  @IsBoolean()
  validarCancelamentoSemPenalidade?: boolean;

  /** @deprecated use antecedenciaMinimaMin */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(168)
  antecedenciaMinimaAgendamentoH?: number;

  /** @deprecated use cancelamentoSemPenalidadeMin */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(72)
  cancelamentoSemPenalidadeH?: number;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateTurnoOperacionalDto)
  turnos?: UpdateTurnoOperacionalDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FeriadoMunicipalDto)
  feriadosMunicipais?: FeriadoMunicipalDto[];
}
export class UpdateFinanceiroDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  diasToleranciaBloqueioPadrao?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  percentualMultaAtrasoPadrao?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  percentualJurosAoMesPadrao?: number;

  @IsOptional()
  @IsString()
  condicaoPagamentoDefault?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsUUID()
  tabelaPrecoAtivaId?: string | null;

  @IsOptional()
  @IsBoolean()
  emiteNfseAutomatico?: boolean;

  @IsOptional()
  @IsBoolean()
  emiteBoletoAutomatico?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  diasVencimentoBoletoPadrao?: number;
}

export class UpdateFiscalDto {
  @IsOptional() @IsString() @Matches(/^\d{7}$/)
  municipioIbge?: string;

  @IsOptional() @IsIn(['IPM', 'ATENDE_NET', 'NONE'])
  provedor?: 'IPM' | 'ATENDE_NET' | 'NONE';

  @IsOptional() @IsString()
  regimeTributario?: string;

  @IsOptional() @IsNumber() @Min(0) @Max(100)
  aliquotaIssPadrao?: number;

  @IsOptional() @IsString()
  certificadoBase64?: string;

  @IsOptional() @IsString()
  certificadoSenha?: string;
}

export class UpdateSegurancaDto {
  @IsOptional() @IsInt() @Min(1) @Max(20)
  tentativasLoginAntesBloqueio?: number;

  @IsOptional() @IsInt() @Min(1) @Max(1440)
  duracaoBloqueioMin?: number;

  @IsOptional() @IsInt() @Min(1) @Max(50)
  sessoesMaximasConcorrentes?: number;

  @IsOptional() @IsInt() @Min(1) @Max(720)
  ttlSessaoHoras?: number;

  @IsOptional() @IsInt() @Min(6) @Max(128)
  senhaMinLength?: number;

  @IsOptional() @IsBoolean()
  senhaExigirMaiuscula?: boolean;

  @IsOptional() @IsBoolean()
  senhaExigirNumero?: boolean;

  @IsOptional() @IsBoolean()
  senhaExigirEspecial?: boolean;

  @IsOptional() @IsBoolean()
  senhaBloquearSequencias?: boolean;

  @IsOptional() @IsBoolean()
  validarDominioCorporativo?: boolean;
}

export class UpdateNotificacoesDto {
  @IsOptional() @IsArray() @IsEmail({}, { each: true })
  emailsAlerta?: string[];

  @IsOptional() @ValidateIf((_, v) => v != null && v !== '')
  @IsUrl({ require_tld: false })
  webhookSlackUrl?: string;

  @IsOptional() @IsBoolean()
  webhookSlackEnabled?: boolean;

  @IsOptional() @IsInt() @Min(1) @Max(120)
  debounceAlertasMin?: number;
}

export class UpdateParametrosGeraisDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateOperacionalDto)
  operacional?: UpdateOperacionalDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateFinanceiroDto)
  financeiro?: UpdateFinanceiroDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateFiscalDto)
  fiscal?: UpdateFiscalDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateSegurancaDto)
  seguranca?: UpdateSegurancaDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateNotificacoesDto)
  notificacoes?: UpdateNotificacoesDto;
}
