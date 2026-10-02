import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CadastrosTabelaTransporteFormDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  nome!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descricao?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  padrao?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  duplicarDeId?: string;
}
