import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateBoletoDto } from './dto/create-boleto.dto';
import { CreateFaturamentoDto } from './dto/create-faturamento.dto';
import { FaturamentoQueryDto } from './dto/faturamento-query.dto';
import { UpdateBoletoDto } from './dto/update-boleto.dto';
import { EmitirNfseDto } from '../nfse/dto/emitir-nfse.dto';
import { CancelarNfseDto } from '../nfse/dto/cancelar-nfse.dto';
import { FaturamentoService } from './faturamento.service';

@ApiTags('faturamento')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Controller('faturamento')
export class FaturamentoController {
  constructor(private readonly faturamentoService: FaturamentoService) {}

  @Get()
  @Roles(Role.ADMIN, Role.GERENTE, Role.CLIENTE)
  @Permissions('faturamento:ler')
  listar(@Query() query: FaturamentoQueryDto, @CurrentUser() user: AuthUser) {
    return this.faturamentoService.findAll(query, user);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.GERENTE, Role.CLIENTE)
  @Permissions('faturamento:ler')
  obter(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.faturamentoService.findOne(id, user);
  }

  @Post()
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('faturamento:criar')
  criar(@Body() dto: CreateFaturamentoDto, @CurrentUser() user: AuthUser) {
    return this.faturamentoService.create(dto, user.id, user);
  }

  @Post(':id/nfse')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('nfse:emitir')
  emitirNfse(
    @Param('id') id: string,
    @Body() dto: EmitirNfseDto,
    @CurrentUser() user: AuthUser,
    @Request() req: { ip?: string; get: (h: string) => string | undefined },
  ) {
    const ip = (req as { ip?: string }).ip || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    return this.faturamentoService.emitirNfse(id, dto, user.id, user, ip, userAgent);
  }

  @Post(':id/nfse/cancelar')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('nfse:cancelar')
  cancelarNfse(
    @Param('id') id: string,
    @Body() dto: CancelarNfseDto,
    @CurrentUser() user: AuthUser,
    @Request() req: { ip?: string; get: (h: string) => string | undefined },
  ) {
    const ip = (req as { ip?: string }).ip || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    return this.faturamentoService.cancelarNfseFaturamento(id, dto, user.id, user, ip, userAgent);
  }

  @Post(':id/boletos')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('boletos:registrar')
  criarBoleto(
    @Param('id') id: string,
    @Body() dto: CreateBoletoDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.faturamentoService.createBoleto(id, dto, user.id, user);
  }

  @Patch('boletos/:boletoId')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('boletos:atualizar')
  atualizarBoleto(
    @Param('boletoId') boletoId: string,
    @Body() dto: UpdateBoletoDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.faturamentoService.updateBoleto(boletoId, dto, user.id, user);
  }
}
