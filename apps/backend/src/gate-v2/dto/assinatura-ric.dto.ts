import { IsIn, IsOptional, IsString } from 'class-validator';

export const ASSINATURA_RIC_MODOS = ['DIGITAL', 'MANUAL'] as const;
export type AssinaturaRicModo = (typeof ASSINATURA_RIC_MODOS)[number];

export class AssinaturaRicDto {
  @IsOptional()
  @IsString()
  assinatura?: string;

  @IsOptional()
  @IsIn(ASSINATURA_RIC_MODOS)
  modo?: AssinaturaRicModo;
}
