import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class ExtratoImportarDto {
  @ApiProperty({ enum: ['OFX', 'CSV'], example: 'CSV' })
  @IsString()
  @IsIn(['OFX', 'CSV'])
  formato!: 'OFX' | 'CSV';

  @ApiProperty({
    description:
      'Conteúdo textual UTF-8 do extrato (OFX completo ou CSV com colunas data,valor,historico).',
  })
  @IsString()
  @MinLength(5)
  conteudo!: string;

  @ApiPropertyOptional({ description: 'Nome amigável da origem (ex.: conta-corrente-main.csv).' })
  @IsOptional()
  @IsString()
  nomeOrigem?: string;
}

export class ExtratoListarQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por lote importado.' })
  @IsOptional()
  @IsString()
  batchId?: string;
}

export class ConciliacaoQueryDto {
  @ApiPropertyOptional({ description: 'Restringe linhas a um lote importado.' })
  @IsOptional()
  @IsString()
  batchId?: string;
}

export class ConciliacaoManualDto {
  @ApiProperty({ description: 'Identificador da linha normalizada (formato batchId:índice).' })
  @IsString()
  extratoLinhaId!: string;

  @ApiProperty()
  @IsString()
  boletoId!: string;

  @ApiProperty()
  @IsString()
  faturamentoId!: string;
}

export class FluxoCaixaQueryDto {
  @ApiProperty({ enum: [7, 30, 90], example: 30 })
  @Type(() => Number)
  @IsIn([7, 30, 90])
  horizonte!: 7 | 30 | 90;
}
