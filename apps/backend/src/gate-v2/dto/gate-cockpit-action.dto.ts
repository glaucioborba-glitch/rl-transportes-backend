import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class GateRetornarEntradaDto {
  @ApiProperty({ description: 'Motivo da devolução do caminhão' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motivo!: string;
}

export class GateRejeitarOsDto {
  @ApiProperty({ description: 'Motivo da rejeição da ordem de serviço' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motivo!: string;
}
