import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import { IsString, MinLength } from 'class-validator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { MobileJwtAuthGuard } from '../guards/mobile-jwt-auth.guard';
import { MobilePushStore } from '../stores/mobile-push.store';
import { MobileTelemetryStore } from '../stores/mobile-telemetry.store';
import type { MobileRequestUser } from '../types/mobile-hub.types';

class FcmDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  token: string;

  @ApiProperty({ enum: ['android', 'ios'] })
  @IsString()
  platform: 'android' | 'ios';
}

@ApiTags('mobile-hub-push')
@ApiBearerAuth('mobile-bearer')
@Controller('mobile/v1/push')
@UseGuards(MobileJwtAuthGuard)
export class MobileV1PushController {
  constructor(private readonly push: MobilePushStore) {}

  @Post('register')
  @ApiOperation({ summary: 'Registrar token FCM/APNs (memória)' })
  reg(@Req() req: Request & { mobileUser?: MobileRequestUser }, @Body() body: FcmDto) {
    const cx = req.mobileUser!;
    this.push.registrarFcm(cx.sub, body.token);
    return { ok: true, platform: body.platform };
  }

  @Get('inbox')
  @ApiOperation({ summary: 'Jobs push pendentes (simulado)' })
  inbox(@Req() req: Request & { mobileUser?: MobileRequestUser }) {
    return this.push.pendentesParaSub(req.mobileUser!.sub);
  }
}

@ApiTags('mobile-hub-admin')
@ApiBearerAuth('access-token')
@Controller('mobile/v1/admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN, Role.GERENTE)
export class MobileV1AdminController {
  constructor(private readonly tel: MobileTelemetryStore, private readonly push: MobilePushStore) {}

  @Get('telemetria')
  @ApiOperation({ summary: 'Agregado telemetria 24h (ADMIN/GERENTE JWT corporativo)' })
  agregado() {
    return this.tel.agregadoStaff();
  }

  @Get('push/jobs')
  @ApiOperation({ summary: 'Últimos jobs push (auditoria operacional)' })
  jobs() {
    return this.push.listarUltimos(80);
  }
}
