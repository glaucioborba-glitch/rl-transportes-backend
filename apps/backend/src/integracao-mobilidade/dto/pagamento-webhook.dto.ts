import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class PagamentoWebhookDto {
  @ApiProperty()
  @IsString()
  @MaxLength(256)
  referencia!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  valor!: number;

  @ApiProperty({ enum: ['confirmado', 'atrasado', 'divergente'] })
  @IsIn(['confirmado', 'atrasado', 'divergente'])
  status!: 'confirmado' | 'atrasado' | 'divergente';

  @ApiPropertyOptional({ enum: ['PIX', 'BOLETO'] })
  @IsOptional()
  @IsIn(['PIX', 'BOLETO'])
  meio?: 'PIX' | 'BOLETO';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correlationId?: string;
}
