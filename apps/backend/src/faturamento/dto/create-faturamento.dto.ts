import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateFaturamentoDto {
  @ApiProperty()
  @IsUUID()
  clienteId!: string;

  /** Período de referência (YYYY-MM), alinhado ao @@unique com cliente. */
  @ApiProperty({ example: '2026-04' })
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'periodo deve estar no formato YYYY-MM' })
  @MaxLength(7)
  periodo!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valorTotal!: number;

  @ApiProperty({ description: 'Solicitações operacionais vinculadas a esta competência', required: false })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  solicitacaoIds?: string[];
}
