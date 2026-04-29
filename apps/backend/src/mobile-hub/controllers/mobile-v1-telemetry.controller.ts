import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { MobileJwtAuthGuard } from '../guards/mobile-jwt-auth.guard';
import { MobileTelemetryStore } from '../stores/mobile-telemetry.store';
import type { MobileRequestUser } from '../types/mobile-hub.types';

class GeoDto {
  @ApiProperty()
  @IsNumber()
  lat: number;

  @ApiProperty()
  @IsNumber()
  lng: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  precisaoM?: number;
}

class TelemetriaDto {
  @ApiProperty({ required: false })
  @ValidateNested()
  @Type(() => GeoDto)
  @IsOptional()
  localizacao?: GeoDto;

  @ApiProperty({ required: false, description: '0–4 ou dBm proxy' })
  @IsOptional()
  @IsNumber()
  redeForca?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  latenciaMsMedia?: number;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  errosRecorrentes?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  usoOffline?: boolean;
}

@ApiTags('mobile-hub-telemetria')
@ApiBearerAuth('mobile-bearer')
@Controller('mobile/v1')
@UseGuards(MobileJwtAuthGuard)
export class MobileV1TelemetryController {
  constructor(private readonly tel: MobileTelemetryStore) {}

  @Post('telemetria')
  @ApiOperation({ summary: 'Lote de telemetria mobile' })
  post(@Req() req: Request & { mobileUser?: MobileRequestUser }, @Body() body: TelemetriaDto) {
    const cx = req.mobileUser!;
    return this.tel.registrar({
      deviceId: cx.deviceId,
      userSub: cx.sub,
      mobileRole: cx.mobileRole,
      localizacao: body.localizacao,
      redeForca: body.redeForca,
      latenciaMsMedia: body.latenciaMsMedia,
      errosRecorrentes: body.errosRecorrentes,
      usoOffline: body.usoOffline,
    });
  }
}
