import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CadastrosCapacidadeContainerFormDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  codigo!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nome!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
