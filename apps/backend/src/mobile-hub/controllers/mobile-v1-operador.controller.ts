import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { MobileJwtAuthGuard } from '../guards/mobile-jwt-auth.guard';
import { MobileRoleGuard } from '../guards/mobile-role.guard';
import { MobileRoles, MobileCriticalRoute } from '../guards/mobile-roles.decorator';
import { MobileBiometricGuard } from '../guards/mobile-biometric.guard';
import { MobileHubOperadorService } from '../services/mobile-hub-operador.service';
import type { MobileRequestUser } from '../types/mobile-hub.types';

class ProtoImgDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  protocolo: string;

  @ApiProperty({ required: false, description: 'Imagem gzip+base64 recomendado no cliente' })
  @IsOptional()
  @IsString()
  imagemBase64?: string;
}

class PatioDto extends ProtoImgDto {
  @ApiProperty()
  @IsString()
  quadra: string;

  @ApiProperty()
  @IsString()
  fileira: string;

  @ApiProperty()
  @IsString()
  posicao: string;
}

@ApiTags('mobile-hub-operador')
@ApiBearerAuth('mobile-bearer')
@Controller('mobile/v1/operador')
@UseGuards(MobileJwtAuthGuard, MobileRoleGuard)
@MobileRoles('OPERADOR_MOBILE')
export class MobileV1OperadorController {
  constructor(private readonly svc: MobileHubOperadorService) {}

  private u(req: Request & { mobileUser?: MobileRequestUser }) {
    return req.mobileUser!;
  }

  @Get('minhas-operacoes')
  @ApiOperation({ summary: 'Últimas operações do operador (payload leve)' })
  minhas(@Req() req: Request & { mobileUser?: MobileRequestUser }) {
    const cx = this.u(req);
    return this.svc.minhasOperacoes(cx.prismaUserId ?? cx.sub);
  }

  @Post('gate-in')
  @MobileCriticalRoute()
  @UseGuards(MobileBiometricGuard)
  @ApiOperation({ summary: 'Gate-in + OCR/foto opcional (dispara evento Fase 14)' })
  async gateIn(@Req() req: Request & { mobileUser?: MobileRequestUser }, @Body() body: ProtoImgDto) {
    return this.svc.gateIn(this.u(req), body);
  }

  @Post('gate-out')
  @MobileCriticalRoute()
  @UseGuards(MobileBiometricGuard)
  @ApiOperation({ summary: 'Gate-out' })
  async gateOut(@Req() req: Request & { mobileUser?: MobileRequestUser }, @Body() body: ProtoImgDto) {
    return this.svc.gateOut(this.u(req), body);
  }

  @Post('patio-evento')
  @ApiOperation({ summary: 'Movimentação de pátio' })
  async patio(@Req() req: Request & { mobileUser?: MobileRequestUser }, @Body() body: PatioDto) {
    return this.svc.patioEvento(this.u(req), body);
  }

  @Get('turno')
  @ApiOperation({ summary: 'Turno operacional (leve)' })
  turno(@Req() req: Request & { mobileUser?: MobileRequestUser }) {
    return this.svc.turno(this.u(req).prismaUserId ?? this.u(req).sub);
  }
}
