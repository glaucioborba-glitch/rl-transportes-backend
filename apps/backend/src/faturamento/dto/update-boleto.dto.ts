import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

/** Alinhado aos valores persistidos em `boletos.statusPagamento` (string). */
const STATUS_BOLETO = ['pendente', 'pago', 'vencido', 'cancelado'] as const;

export class UpdateBoletoDto {
  @ApiProperty({ enum: STATUS_BOLETO })
  @IsIn([...STATUS_BOLETO])
  statusPagamento!: (typeof STATUS_BOLETO)[number];
}
