import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class SimularValoresPortalDto {
  @ApiProperty({ description: 'Id da unidade no saldo do pátio (ou ISO)' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  unidadeId!: string;

  @ApiProperty({ example: '2026-08-20', description: 'Data prevista de saída (AAAA-MM-DD)' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Informe a data de saída no formato AAAA-MM-DD.' })
  dataSaida!: string;

  @ApiPropertyOptional({ type: [String], description: 'Códigos de serviços adicionais da tabela vigente' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(32, { each: true })
  servicos?: string[];
}
