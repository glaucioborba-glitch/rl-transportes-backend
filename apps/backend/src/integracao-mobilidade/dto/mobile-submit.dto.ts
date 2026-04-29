import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Payload enxuto para mobile — campos opcionais para compatibilidade offline-first. */
export class MobileSubmitBodyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  protocolo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacao?: string;

  @ApiPropertyOptional({ description: 'Imagem base64 (preferir compressão gzip no app antes do envio).' })
  @IsOptional()
  @IsString()
  @MinLength(0)
  imagemBase64?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  lng?: number;
}
