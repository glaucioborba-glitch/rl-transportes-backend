import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MotivoLancamentoContaCorrente, TipoLancamentoContaCorrente } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CriarLancamentoContaCorrenteDto {
  @ApiProperty({ enum: TipoLancamentoContaCorrente })
  @IsEnum(TipoLancamentoContaCorrente)
  tipo!: TipoLancamentoContaCorrente;

  @ApiProperty({ example: 150.5 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9_999_999.99)
  valor!: number;

  @ApiPropertyOptional({ enum: MotivoLancamentoContaCorrente })
  @IsOptional()
  @IsEnum(MotivoLancamentoContaCorrente)
  motivo?: MotivoLancamentoContaCorrente;

  @ApiProperty({ example: 'Acordo da operação de baixa do dia 13/09' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  descricao!: string;

  @ApiPropertyOptional({ example: 'PIX 13/09 ou ISO ABCD 123456-0' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  referencia?: string;
}

export class CompensarContaCorrenteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descricao?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  referencia?: string;
}
