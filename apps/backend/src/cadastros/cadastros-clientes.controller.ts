import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CadastrosClientesService } from './cadastros-clientes.service';
import { CadastrosTransportadorasService } from './cadastros-transportadoras.service';
import { CadastrosClienteFormDto } from './dto/cadastros-cliente-form.dto';
import { CadastrosClienteQueryDto } from './dto/cadastros-cliente-query.dto';

@ApiTags('cadastros')
@ApiBearerAuth('access-token')
@Controller('v2/cadastros')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
export class CadastrosClientesController {
  constructor(
    private readonly service: CadastrosClientesService,
    private readonly transportadorasService: CadastrosTransportadorasService,
  ) {}

  @Get('clientes')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('clientes:ler')
  @ApiOperation({ summary: 'Listar clientes (cadastros MDM)' })
  list(@Query() query: CadastrosClienteQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.list(query, user);
  }

  @Get('clientes/:id')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('clientes:ler')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.findOne(id, user);
  }

  @Post('clientes')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('clientes:criar')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CadastrosClienteFormDto,
    @Request() req: { user: { sub: string }; ip?: string; get: (h: string) => string | undefined },
  ) {
    const ip = req.ip || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    return this.service.create(dto, req.user.sub, ip, userAgent);
  }

  @Put('clientes/:id')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('clientes:atualizar')
  update(
    @Param('id') id: string,
    @Body() dto: CadastrosClienteFormDto,
    @Request() req: { user: { sub: string }; ip?: string; get: (h: string) => string | undefined },
    @CurrentUser() user: AuthUser,
  ) {
    const ip = req.ip || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    return this.service.update(id, dto, req.user.sub, ip, userAgent, user);
  }

  @Patch('clientes/:id/inativar')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('clientes:excluir')
  inativar(
    @Param('id') id: string,
    @Request() req: { user: { sub: string }; ip?: string; get: (h: string) => string | undefined },
  ) {
    const ip = req.ip || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    return this.service.inativar(id, req.user.sub, ip, userAgent);
  }

  @Get('clientes/:id/auditoria')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('auditoria:ler')
  auditoria(@Param('id') id: string) {
    return this.service.listAuditoria(id);
  }

  @Get('validate/cnpj/:cnpj')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('clientes:ler')
  validateCnpj(@Param('cnpj') cnpj: string) {
    return this.service.validateCnpj(cnpj);
  }

  @Get('validate/rntrc/:rntrc')
  @Roles(Role.ADMIN, Role.GERENTE)
  validateRntrc(@Param('rntrc') rntrc: string) {
    return this.transportadorasService.validateRntrc(rntrc);
  }

  @Get('cep/:cep')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('clientes:ler')
  lookupCep(@Param('cep') cep: string) {
    return this.service.lookupCep(cep);
  }
}
