import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { MobileJwtAuthGuard } from '../guards/mobile-jwt-auth.guard';
import { MobileRoleGuard } from '../guards/mobile-role.guard';
import { MobileRoles } from '../guards/mobile-roles.decorator';
import { MobileHubClienteService } from '../services/mobile-hub-cliente.service';
import type { MobileRequestUser } from '../types/mobile-hub.types';

@ApiTags('mobile-hub-cliente')
@ApiBearerAuth('mobile-bearer')
@Controller('mobile/v1/cliente')
@UseGuards(MobileJwtAuthGuard, MobileRoleGuard)
@MobileRoles('CLIENTE_APP')
export class MobileV1ClienteController {
  constructor(private readonly svc: MobileHubClienteService) {}

  @Get('tracking')
  @ApiOperation({ summary: 'Tracking + KPIs leves + proxy marketplace' })
  tracking(@Req() req: Request & { mobileUser?: MobileRequestUser }) {
    return this.svc.tracking(req.mobileUser!);
  }
}
