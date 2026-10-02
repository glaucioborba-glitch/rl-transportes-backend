import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { MovTipo } from '@prisma/client';

export class PatioMovimentarDto {
  @ApiProperty()
  @IsUUID()
  unidadeId!: string;

  @ApiPropertyOptional({ description: 'Baia origem (omitir se lift-on da rua)' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  codigoBaiaOrigem?: string;

  @ApiPropertyOptional({ description: 'Baia destino (omitir em lift-off)' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  codigoBaiaDestino?: string;

  @ApiProperty({ enum: MovTipo })
  @IsIn(['LIFT_ON', 'LIFT_OFF', 'SHIFT', 'REPOSICIONAMENTO'])
  tipo!: MovTipo;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacao?: string;
}
