import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CreateFaturamentoItemDto } from './create-faturamento-item.dto';

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

  /**
   * Linhas do faturamento. O total (`valorTotal` no banco) é a **soma** destes itens;
   * não é permitido informar o total manualmente.
   */
  @ApiProperty({ type: [CreateFaturamentoItemDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Informe ao menos um item de faturamento' })
  @ValidateNested({ each: true })
  @Type(() => CreateFaturamentoItemDto)
  itens!: CreateFaturamentoItemDto[];

  @ApiPropertyOptional({
    description: 'Solicitações operacionais vinculadas a esta competência',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  solicitacaoIds?: string[];
}
