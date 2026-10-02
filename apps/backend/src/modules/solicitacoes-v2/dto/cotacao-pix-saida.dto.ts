import { ApiProperty } from '@nestjs/swagger';
import { TipoOperacaoSolicitacaoIntent } from '@prisma/client';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsOptional, IsString, Matches } from 'class-validator';

export class CotacaoPixSaidaDto {
  @ApiProperty({ enum: TipoOperacaoSolicitacaoIntent })
  @IsEnum(TipoOperacaoSolicitacaoIntent)
  tipoOperacao!: TipoOperacaoSolicitacaoIntent;

  @ApiProperty({ type: [String], example: ['GCXU5119401'] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @IsString({ each: true })
  unidades!: string[];

  @ApiProperty({ example: '2026-09-30', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dataRef deve ser AAAA-MM-DD.' })
  dataRef?: string;
}
