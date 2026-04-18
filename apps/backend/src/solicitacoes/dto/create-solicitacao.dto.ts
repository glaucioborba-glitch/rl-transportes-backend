import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { CreateUnidadeDto } from './create-unidade.dto';

export class CreateSolicitacaoDto {
  @ApiProperty()
  @IsUUID()
  clienteId!: string;

  @ApiProperty({ type: [CreateUnidadeDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1, { message: 'Informe ao menos uma unidade (container) na solicitação' })
  @ValidateNested({ each: true })
  @Type(() => CreateUnidadeDto)
  unidades!: CreateUnidadeDto[];
}
