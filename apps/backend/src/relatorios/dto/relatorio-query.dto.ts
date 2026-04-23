import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class RelatorioQueryDto {
  @ApiProperty({ description: 'Início do intervalo (ISO 8601 date ou datetime)' })
  @IsDateString()
  dataInicio!: string;

  @ApiProperty({ description: 'Fim do intervalo (ISO 8601 date ou datetime)' })
  @IsDateString()
  dataFim!: string;

  @ApiPropertyOptional({ description: 'Restringe resumo financeiro a um cliente' })
  @IsOptional()
  @IsUUID()
  clienteId?: string;
}
