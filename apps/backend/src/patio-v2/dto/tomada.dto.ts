import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class PatioTomadaConectarDto {
  @ApiPropertyOptional({ description: 'Set point (°C) ao conectar' })
  @IsOptional()
  @IsNumber()
  @Min(-30)
  @Max(30)
  setPoint?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacao?: string;
}

export class PatioTomadaDesconectarDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacao?: string;
}

export class PortalSolicitarTomadaDto {
  @ApiProperty({ description: 'Set point desejado (°C)' })
  @IsNumber()
  @Min(-30)
  @Max(30)
  setPoint!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacao?: string;
}
