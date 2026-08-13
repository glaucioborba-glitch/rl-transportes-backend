import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, Length, MaxLength, ValidateIf, ValidateNested } from 'class-validator';
import { GateDivergenciaItemDto } from './gate-divergencia.dto';

export class GateCheckInDto {
  @ApiProperty()
  @IsString()
  @Length(7, 12)
  placaCavalo!: string;

  @ApiProperty()
  @IsString()
  @Length(7, 12)
  placaCarreta01!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(7, 12)
  placaCarreta02?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  motoristaNome!: string;

  @ApiProperty()
  @IsString()
  @Length(11, 11)
  motoristaCpf!: string;

  @ApiPropertyOptional({ description: 'Hash do PDF antifraude (opcional se equipe já validou no painel).' })
  @IsOptional()
  @ValidateIf((_o, v) => v != null && String(v).trim() !== '')
  @IsString()
  @Length(64, 64)
  pdfHash?: string;

  @ApiPropertyOptional({ type: [GateDivergenciaItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GateDivergenciaItemDto)
  divergenciasOperador?: GateDivergenciaItemDto[];

  @ApiPropertyOptional({
    description: 'Avarias rápidas da vistoria (ex: AMASSADO_LATERAL, SEM_LACRE)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  avarias?: string[];
}
