import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { LOG_ORIGENS } from '../observabilidade.types';
import type { LogOrigem, LogSeveridade } from '../observabilidade.types';

const ORIG = [...LOG_ORIGENS];
const SEV = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'] as const;

export class ObservabilidadeLogsQueryDto {
  @ApiPropertyOptional({ enum: LOG_ORIGENS })
  @IsOptional()
  @IsIn(ORIG)
  origem?: LogOrigem;

  @ApiPropertyOptional({ enum: SEV })
  @IsOptional()
  @IsIn([...SEV])
  severidade?: LogSeveridade;

  @ApiPropertyOptional({ minimum: 1, maximum: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
