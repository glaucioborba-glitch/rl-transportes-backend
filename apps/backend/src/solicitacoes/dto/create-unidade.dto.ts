import { ApiProperty } from '@nestjs/swagger';
import { TipoUnidade } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsString } from 'class-validator';
import { normalizeContainerIso } from '../../common/utils/data-sanitize';
import { IsIso6346 } from '../../common/validators/is-iso6346.decorator';

export class CreateUnidadeDto {
  @ApiProperty({ example: 'TEMU1234567' })
  @Transform(({ value }) => (typeof value === 'string' ? normalizeContainerIso(value) : value))
  @IsString()
  @IsIso6346()
  numeroIso!: string;

  @ApiProperty({ enum: TipoUnidade })
  @IsEnum(TipoUnidade)
  tipo!: TipoUnidade;
}
