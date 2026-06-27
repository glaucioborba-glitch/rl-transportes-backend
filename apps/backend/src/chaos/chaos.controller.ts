import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ObservabilityRateLimitGuard } from '../observability/observability-rate-limit.guard';
import { CircuitBreakerService } from '../resilience/circuit-breaker.service';
import { ChaosService } from './chaos.service';
import { ChaosBloqueioDto } from './dto/chaos-bloqueio.dto';
import { ChaosLatenciaDto } from './dto/chaos-latencia.dto';
import { ChaosMsDto } from './dto/chaos-ms.dto';
import { ChaosTurbulenciaDto } from './dto/chaos-turbulencia.dto';

@ApiTags('admin-chaos')
@ApiBearerAuth('access-token')
@Controller('admin/chaos')
@UseGuards(AuthGuard('jwt'), RolesGuard, ObservabilityRateLimitGuard)
@Roles(Role.ADMIN)
export class ChaosController {
  constructor(
    private readonly chaos: ChaosService,
    private readonly circuit: CircuitBreakerService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Estado atual do Chaos Monkey + circuitos' })
  async status() {
    const [chaos, circuits] = await Promise.all([Promise.resolve(this.chaos.status()), this.circuit.listStates()]);
    const openServices = Object.entries(circuits)
      .filter(([, v]) => v.phase === 'OPEN')
      .map(([k]) => k);
    return { chaos, circuits, openServices };
  }

  @Post('falha-db')
  @HttpCode(200)
  @ApiOperation({ summary: 'Simular indisponibilidade do PostgreSQL (curto, sintético)' })
  async falhaDb(@Body() body: ChaosMsDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.chaos.falhaDb(user.id, body.ms, req.ip, req.get('user-agent') ?? undefined);
  }

  @Post('falha-redis')
  @HttpCode(200)
  @ApiOperation({ summary: 'Congelar operações Redis (espera sintética)' })
  async falhaRedis(@Body() body: ChaosMsDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.chaos.falhaRedis(user.id, body.ms, req.ip, req.get('user-agent') ?? undefined);
  }

  @Post('latencia')
  @HttpCode(200)
  @ApiOperation({ summary: 'Injetar latência em rotas security / agendamentos / solicitações' })
  async latencia(@Body() body: ChaosLatenciaDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.chaos.latencia(user.id, body, req.ip, req.get('user-agent') ?? undefined);
  }

  @Post('bloqueio-rota')
  @HttpCode(200)
  @ApiOperation({ summary: 'Responder 503/504 em prefixo de rota' })
  async bloqueio(@Body() body: ChaosBloqueioDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.chaos.bloqueioRota(user.id, body, req.ip, req.get('user-agent') ?? undefined);
  }

  @Post('turbulencia')
  @HttpCode(200)
  @ApiOperation({ summary: 'Modo turbulência: DB + latência Redis + bloqueio de rota' })
  async turbulencia(@Body() body: ChaosTurbulenciaDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.chaos.turbulencia(user.id, body.durationMs, req.ip, req.get('user-agent') ?? undefined);
  }

  @Post('reset')
  @HttpCode(200)
  @ApiOperation({ summary: 'Remover todas as sabotagens sintéticas' })
  async reset(@CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.chaos.reset(user.id, req.ip, req.get('user-agent') ?? undefined);
  }
}
