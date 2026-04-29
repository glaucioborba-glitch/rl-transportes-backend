import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

const ESTADOS = ['criado', 'portaria', 'gate-in', 'patio', 'gate-out', 'finalizado'] as const;

export class ValidarTransicaoDto {
  @ApiProperty({ enum: ESTADOS })
  @IsString()
  @IsIn([...ESTADOS])
  de: (typeof ESTADOS)[number];

  @ApiProperty({ enum: ESTADOS })
  @IsString()
  @IsIn([...ESTADOS])
  para: (typeof ESTADOS)[number];
}
