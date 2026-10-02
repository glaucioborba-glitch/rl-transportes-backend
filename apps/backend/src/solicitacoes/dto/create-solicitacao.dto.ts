import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoFluxoLogistico } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { CreateUnidadeDto } from './create-unidade.dto';

export class CreateSolicitacaoDto {
  @ApiProperty()
  @IsUUID()
  clienteId!: string;

  @ApiPropertyOptional({ enum: TipoFluxoLogistico, description: 'Fluxo FL / armazenagem' })
  @IsOptional()
  @IsEnum(TipoFluxoLogistico)
  tipoFluxo?: TipoFluxoLogistico;

  @ApiPropertyOptional({
    type: [String],
    description: 'Serviços adicionais (inspeção, reparo, pesagem, vistoria, …)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  servicosAdicionais?: string[];

  @ApiProperty({ type: [CreateUnidadeDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1, { message: 'Informe ao menos uma unidade (container) na solicitação' })
  @ValidateNested({ each: true })
  @Type(() => CreateUnidadeDto)
  unidades!: CreateUnidadeDto[];
}
