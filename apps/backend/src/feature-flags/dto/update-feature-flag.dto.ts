import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateFeatureFlagDto {
  @ApiProperty()
  @IsBoolean()
  ativo!: boolean;

  @ApiPropertyOptional({ description: 'CNPJs (14 dígitos) — vazio = global' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cnpjAllowList?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tenantIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descricao?: string;
}
