import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Envelope REST padronizado (API Gateway v1). */
export class ApiMetaDto {
  @ApiProperty({ example: 'v1' })
  apiVersion!: string;

  @ApiPropertyOptional({ description: 'Correlation / request id quando disponível' })
  requestId?: string;

  @ApiPropertyOptional({ description: 'Timestamp ISO da resposta' })
  timestamp?: string;
}

export class ApiEnvelopeDto<T = unknown> {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiPropertyOptional({ description: 'Código de erro de negócio (quando success=false)' })
  error?: string;

  @ApiPropertyOptional()
  data?: T;

  @ApiPropertyOptional({ type: ApiMetaDto })
  meta!: ApiMetaDto;
}
