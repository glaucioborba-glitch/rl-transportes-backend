import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { STATUS_CARGA_TRANSPORTE } from '../local-transporte-pair.util';

export class CadastrosTarifaTransporteFormDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tabelaId?: string;

  @ApiProperty()
  @IsUUID()
  origemId!: string;

  @ApiProperty()
  @IsUUID()
  destinoId!: string;

  @ApiProperty({ enum: STATUS_CARGA_TRANSPORTE })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsIn([...STATUS_CARGA_TRANSPORTE])
  statusCarga!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  tipoContainerCodigos?: string[];

  @ApiPropertyOptional()
  @ValidateIf((o: CadastrosTarifaTransporteFormDto) => !o.tipoContainerCodigos?.length)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  tipoContainerCodigo?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  retorno?: boolean;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  valor!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : value;
  })
  @IsNumber()
  @Min(0)
  valorPagoTerceiro?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacao?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
