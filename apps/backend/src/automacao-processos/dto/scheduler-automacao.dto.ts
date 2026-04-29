import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CriarCronJobDto {
  @ApiProperty({ example: '0 6 * * *', description: 'Expressão cron (definição corporativa; motor in-process opcional).' })
  @IsString()
  expressao: string;

  @ApiProperty({ example: 'Relatório diário BI' })
  @IsString()
  descricao: string;

  @ApiProperty({ example: 'datahub:etl_diario_simulado' })
  @IsString()
  acao: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
