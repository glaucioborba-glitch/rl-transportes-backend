import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsNumber, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { MobileJwtAuthGuard } from '../guards/mobile-jwt-auth.guard';
import { MobileSyncService } from '../services/mobile-sync.service';
import type { MobileRequestUser } from '../types/mobile-hub.types';
import type { OfflineOpType } from '../stores/mobile-offline-sync.store';

class SyncItemDto {
  @ApiProperty({ enum: ['gate_in', 'gate_out', 'patio', 'portaria', 'checkin_motorista', 'telemetria_batch'] })
  @IsString()
  @IsIn(['gate_in', 'gate_out', 'patio', 'portaria', 'checkin_motorista', 'telemetria_batch'])
  op: OfflineOpType;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  body: Record<string, unknown>;

  @ApiProperty({ description: 'Timestamp cliente (ms) para LWW' })
  @IsNumber()
  clientTs: number;
}

class EnqueueDto {
  @ApiProperty({ type: [SyncItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncItemDto)
  events: SyncItemDto[];
}

class FlushDto {
  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ids?: string[];
}

@ApiTags('mobile-hub-sync')
@ApiBearerAuth('mobile-bearer')
@Controller('mobile/v1/sync')
@UseGuards(MobileJwtAuthGuard)
export class MobileV1SyncController {
  constructor(private readonly sync: MobileSyncService) {}

  @Post('enqueue')
  @ApiOperation({ summary: 'Enfileirar lote offline' })
  enqueue(@Req() req: Request & { mobileUser?: MobileRequestUser }, @Body() body: EnqueueDto) {
    const cx = req.mobileUser!;
    return body.events.map((e) => this.sync.enfileirar(cx, e.op, e.body as Record<string, unknown>, e.clientTs));
  }

  @Post('flush')
  @ApiOperation({ summary: 'Flush / replicação (LWW)' })
  flush(@Req() req: Request & { mobileUser?: MobileRequestUser }, @Body() body: FlushDto) {
    return this.sync.flush(req.mobileUser!, body.ids);
  }
}
