import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { MobileSubmitBodyDto } from '../dto/mobile-submit.dto';
import { MobileOperadorGuard } from '../guards/mobile-operador.guard';
import { MobileOperacionalService } from '../services/mobile-operacional.service';

@ApiTags('integracao-mobile')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), MobileOperadorGuard)
@Controller('mobile')
export class MobileOperacionalController {
  constructor(private readonly mobile: MobileOperacionalService) {}

  @Post('portaria')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Checkpoint portaria (payload minimo)' })
  portaria(@CurrentUser() user: AuthUser, @Body() dto: MobileSubmitBodyDto) {
    return this.mobile.registrar(user.id, 'portaria', dto);
  }

  @Post('gate')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Checkpoint gate' })
  gate(@CurrentUser() user: AuthUser, @Body() dto: MobileSubmitBodyDto) {
    return this.mobile.registrar(user.id, 'gate', dto);
  }

  @Post('patio')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Checkpoint patio' })
  patio(@CurrentUser() user: AuthUser, @Body() dto: MobileSubmitBodyDto) {
    return this.mobile.registrar(user.id, 'patio', dto);
  }

  @Post('saida')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Checkpoint saida' })
  saida(@CurrentUser() user: AuthUser, @Body() dto: MobileSubmitBodyDto) {
    return this.mobile.registrar(user.id, 'saida', dto);
  }

  @Get('minhas-operacoes')
  @ApiOperation({ summary: 'Ultimas operacoes aceitas pelo terminal (memoria)' })
  minhas(@CurrentUser() user: AuthUser) {
    return this.mobile.listOps(user.id);
  }

  @Get('turno')
  @ApiOperation({ summary: 'Snapshot de turno (placeholder integravel ao RH)' })
  turno(@CurrentUser() user: AuthUser) {
    return this.mobile.turno(user.id);
  }
}
