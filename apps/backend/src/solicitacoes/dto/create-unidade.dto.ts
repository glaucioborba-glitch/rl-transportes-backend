import { ApiProperty } from '@nestjs/swagger';
import { TipoUnidade } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsString, Matches } from 'class-validator';

export class CreateUnidadeDto {
  @ApiProperty({ example: 'TEMU1234567' })
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\s/g, '').toUpperCase() : value))
  @IsString()
  @Matches(/^[A-Z]{4}[0-9]{6}[0-9]$/, {
    message: 'Número ISO 6346 inválido (formato esperado: 4 letras + 6 dígitos + dígito verificador)',
  })
  numeroIso!: string;

  @ApiProperty({ enum: TipoUnidade })
  @IsEnum(TipoUnidade)
  tipo!: TipoUnidade;
}
