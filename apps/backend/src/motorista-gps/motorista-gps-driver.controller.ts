import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { CurrentGpsMotorista } from './current-gps-motorista.decorator';
import { MotoristaGpsLoginDto } from './dto/motorista-gps-login.dto';
import { MotoristaGpsPingDto } from './dto/motorista-gps-ping.dto';
import { MotoristaGpsGuard } from './motorista-gps.guard';
import { mapGpsCoordError, MotoristaGpsService } from './motorista-gps.service';
import type { MotoristaGpsJwtPayload } from './motorista-gps.types';

@ApiTags('motorista-gps')
@Public()
@Controller('v2/motorista-gps')
export class MotoristaGpsDriverController {
  constructor(private readonly service: MotoristaGpsService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login do motorista interno/terceiro para enviar GPS' })
  login(@Body() dto: MotoristaGpsLoginDto) {
    return this.service.login(dto.cpf, dto.pin);
  }

  @Get('me')
  @UseGuards(MotoristaGpsGuard)
  @ApiBearerAuth('access-token')
  me(@CurrentGpsMotorista() gps: MotoristaGpsJwtPayload) {
    return this.service.me(gps);
  }

  @Post('ping')
  @UseGuards(MotoristaGpsGuard)
  @ApiBearerAuth('access-token')
  ping(@CurrentGpsMotorista() gps: MotoristaGpsJwtPayload, @Body() dto: MotoristaGpsPingDto) {
    try {
      return this.service.ping(gps, dto.lat, dto.lng, dto.precisaoM);
    } catch (e) {
      mapGpsCoordError(e);
    }
  }

  @Post('parar')
  @UseGuards(MotoristaGpsGuard)
  @ApiBearerAuth('access-token')
  parar(@CurrentGpsMotorista() gps: MotoristaGpsJwtPayload) {
    return this.service.parar(gps);
  }
}
