import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StatusOrdemTransporte } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateOrdemStatusDto {
  @ApiProperty({ enum: StatusOrdemTransporte })
  @IsEnum(StatusOrdemTransporte)
  status!: StatusOrdemTransporte;

  @ApiPropertyOptional({ description: 'URL da foto POD (alternativa ao upload multipart)' })
  @IsOptional()
  @IsString()
  podFotoUrl?: string;
}
