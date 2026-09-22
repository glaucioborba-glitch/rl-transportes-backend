import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ALCANCES_EMBARQUE, CAMPOS_EMBARQUE } from '../embarque-campo.util';

export class UpdatePortalEmbarqueDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  solicitacaoId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  unidadeIso!: string;

  @ApiProperty({ enum: CAMPOS_EMBARQUE })
  @IsIn([...CAMPOS_EMBARQUE])
  campo!: (typeof CAMPOS_EMBARQUE)[number];

  @ApiProperty({ description: 'Novo valor (vazio limpa o campo)' })
  @IsString()
  @MaxLength(120)
  valor!: string;

  @ApiPropertyOptional({
    enum: ALCANCES_EMBARQUE,
    description: 'unidade | processo | booking | navio',
  })
  @IsOptional()
  @IsIn([...ALCANCES_EMBARQUE])
  alcance?: (typeof ALCANCES_EMBARQUE)[number];
}

