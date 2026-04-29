import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { MobileJwtAuthGuard } from '../guards/mobile-jwt-auth.guard';
import { MobileRoleGuard } from '../guards/mobile-role.guard';
import { MobileRoles } from '../guards/mobile-roles.decorator';
import { MobileHubMotoristaService } from '../services/mobile-hub-motorista.service';
import type { MobileRequestUser } from '../types/mobile-hub.types';

class CheckinDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  protocolo: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  qrPayload?: string;
}

@ApiTags('mobile-hub-motorista')
@ApiBearerAuth('mobile-bearer')
@Controller('mobile/v1/motorista')
@UseGuards(MobileJwtAuthGuard, MobileRoleGuard)
@MobileRoles('MOTORISTA')
export class MobileV1MotoristaController {
  constructor(private readonly svc: MobileHubMotoristaService) {}

  @Post('checkin')
  @ApiOperation({ summary: 'Check-in digital (senha/QR opcional)' })
  checkin(@Req() req: Request & { mobileUser?: MobileRequestUser }, @Body() body: CheckinDto) {
    return this.svc.checkin(req.mobileUser!, body);
  }

  @Get('solicitacao')
  @ApiOperation({ summary: 'Tracking mínimo da solicitação' })
  solic(
    @Req() req: Request & { mobileUser?: MobileRequestUser },
    @Query('protocolo') protocolo?: string,
  ) {
    return this.svc.solicitacao(req.mobileUser!, protocolo);
  }
}
