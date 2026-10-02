import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { MAX_UNIDADES_SIMULACAO } from '../portal-simulacao-valores.util';

export class SimularValoresPortalDto {
  /** @deprecated use unidadeIds — mantido para compatibilidade. */
  @ApiPropertyOptional({ description: 'Id da unidade no saldo do pátio (ou ISO). Prefira unidadeIds.' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  unidadeId?: string;

  @ApiPropertyOptional({ type: [String], description: 'Unidades no pátio (id ou ISO) para simular juntas' })
  @ValidateIf((o: SimularValoresPortalDto) => !o.unidadeId?.trim())
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_UNIDADES_SIMULACAO)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  unidadeIds?: string[];

  @ApiProperty({ example: '2026-08-20', description: 'Data prevista de saída (AAAA-MM-DD)' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Informe a data de saída no formato AAAA-MM-DD.' })
  dataSaida!: string;
}
