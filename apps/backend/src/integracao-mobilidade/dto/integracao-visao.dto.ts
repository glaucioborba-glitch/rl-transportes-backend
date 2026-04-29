import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class OcrCameraDto {
  @ApiPropertyOptional({ description: 'Google Vision, AWS Rekognition, etc.' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  provedor?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  placas?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imagemBase64?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correlationId?: string;
}

export class OcrGateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  protocolo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  placa?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correlationId?: string;
}
