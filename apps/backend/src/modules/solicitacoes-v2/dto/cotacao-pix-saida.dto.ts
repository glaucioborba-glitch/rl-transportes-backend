import { ApiProperty } from '@nestjs/swagger';
import { TipoOperacaoSolicitacaoIntent } from '@prisma/client';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsString } from 'class-validator';

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
}
