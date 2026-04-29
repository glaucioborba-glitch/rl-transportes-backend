import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

const ROBOTS = [
  'rpa_faturamento_auto',
  'rpa_nfse_sugestao',
  'rpa_reconcilia_boleto',
  'rpa_operacao_ciclo',
  'rpa_rh_absenteismo',
  'rpa_grc_incidentes',
] as const;

export class RpaRunDto {
  @ApiProperty({ enum: ROBOTS })
  @IsString()
  @IsIn([...ROBOTS])
  robotId: (typeof ROBOTS)[number];
}
