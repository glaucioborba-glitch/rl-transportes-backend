import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CadastrosUnidadeAluguelFormDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @MinLength(4)
  @MaxLength(16)
  unidadeIso!: string;

  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  tipoContainerCodigo!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(8)
  containerTamanho!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  capacidadeCodigo?: string;

  @ApiPropertyOptional({ default: 'DISPONIVEL' })
  @IsOptional()
  @IsIn(['DISPONIVEL', 'ALUGADA', 'MANUTENCAO', 'USO_PROPRIO', 'INATIVA'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacao?: string;
}
