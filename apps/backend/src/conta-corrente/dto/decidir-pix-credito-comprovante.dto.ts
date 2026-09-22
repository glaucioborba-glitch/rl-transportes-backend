import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum DecisaoPixCreditoComprovante {
  APROVADO = 'APROVADO',
  NEGADO = 'NEGADO',
}

export class DecidirPixCreditoComprovanteDto {
  @ApiProperty({ enum: DecisaoPixCreditoComprovante })
  @IsEnum(DecisaoPixCreditoComprovante)
  decisao!: DecisaoPixCreditoComprovante;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacao?: string;
}
