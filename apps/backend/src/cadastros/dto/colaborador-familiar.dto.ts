import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateFamiliarDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  nome!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return undefined;
    return typeof value === 'string' ? value.replace(/\D/g, '') : value;
  })
  @IsString()
  @Length(11, 11, { message: 'CPF deve ter 11 dígitos.' })
  cpf?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dataAniversario?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  parentesco?: string;
}

export class UpdateFamiliarDto extends PartialType(CreateFamiliarDto) {}

export class ColaboradorFamiliarFormDto extends CreateFamiliarDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;
}

export class ColaboradorFamiliaresFormField {
  @ApiPropertyOptional({ type: [ColaboradorFamiliarFormDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ColaboradorFamiliarFormDto)
  familiares?: ColaboradorFamiliarFormDto[];
}
