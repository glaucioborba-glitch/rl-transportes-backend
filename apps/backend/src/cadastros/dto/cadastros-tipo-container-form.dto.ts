import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CadastrosTipoContainerFormDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  codigo!: string;

  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nome!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tamanhos?: string[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  tomadaReefer?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

export class CadastrosContainerCacheCreateDto {
  @ApiProperty()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/[\s-]/g, '').toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[A-Z]{4}\d{7}$/, { message: 'Número ISO 6346 inválido.' })
  numeroISO!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tipo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tamanho?: string;
}
