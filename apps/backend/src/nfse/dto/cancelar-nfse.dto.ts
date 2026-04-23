import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CancelarNfseDto {
  @ApiProperty({ description: 'Motivo do cancelamento (conforme prefeitura).' })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  motivo!: string;

  @ApiPropertyOptional({ description: 'Série da NFS-e (padrão 1).' })
  @IsOptional()
  @IsString()
  @MaxLength(4)
  serieNfse?: string;

  @ApiPropertyOptional({ description: 'Se omitido, usa a NFS-e mais recente do faturamento com status ACEITO.' })
  @IsOptional()
  @IsString()
  nfsEmitidaId?: string;
}
