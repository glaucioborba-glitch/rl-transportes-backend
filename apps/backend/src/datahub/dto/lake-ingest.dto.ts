import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';

const ORIGENS = ['operacional', 'financeiro', 'fiscal', 'rh', 'ia', 'grc'] as const;

export class LakeIngestDto {
  @ApiProperty({
    enum: ORIGENS,
    example: 'operacional',
    description:
      'Camada RAW — origem sem transformação (operacional | financeiro | fiscal | rh | ia | grc).',
  })
  @IsIn([...ORIGENS])
  origem!: (typeof ORIGENS)[number];

  @ApiProperty({
    example: { evento: 'snapshot', ref: 'SOL-1' },
    description: 'Payload JSON bruto persistido virtualmente com versionamento `YYYY/MM/DD/HH/mm`.',
  })
  @IsObject()
  payload!: Record<string, unknown>;

  @ApiPropertyOptional({ example: 'carga-manual-teste' })
  @IsOptional()
  @IsString()
  rotulo?: string;
}
