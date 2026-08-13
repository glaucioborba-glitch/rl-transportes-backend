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
import { CadastrosTransportadorasService } from './cadastros-transportadoras.service';
import { CadastrosTransportadoraFormDto } from './dto/cadastros-transportadora-form.dto';
import { CadastrosTransportadoraQueryDto } from './dto/cadastros-transportadora-query.dto';

const CADASTROS_ROLES = [Role.ADMIN, Role.GERENTE] as const;

@ApiTags('cadastros')
@ApiBearerAuth('access-token')
@Controller('v2/cadastros/transportadoras')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Roles(...CADASTROS_ROLES)
export class CadastrosTransportadorasController {
  constructor(private readonly service: CadastrosTransportadorasService) {}

  @Get()
  @ApiOperation({ summary: 'Listar transportadoras (cadastros MDM)' })
  list(@Query() query: CadastrosTransportadoraQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.list(query, user);
  }

  @Get(':id/auditoria')
  @Permissions('auditoria:ler')
  @ApiOperation({ summary: 'Histórico de alterações' })
  auditoria(@Param('id') id: string) {
    return this.service.listAuditoria(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe da transportadora' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Criar transportadora' })
  create(
    @Body() dto: CadastrosTransportadoraFormDto,
    @Request() req: { user: { sub: string }; ip?: string; get: (h: string) => string | undefined },
  ) {
    const ip = req.ip || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    return this.service.create(dto, req.user.sub, ip, userAgent);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar transportadora' })
  update(
    @Param('id') id: string,
    @Body() dto: CadastrosTransportadoraFormDto,
    @Request() req: { user: { sub: string }; ip?: string; get: (h: string) => string | undefined },
  ) {
    const ip = req.ip || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    return this.service.update(id, dto, req.user.sub, ip, userAgent);
  }

  @Patch(':id/inativar')
  @ApiOperation({ summary: 'Inativar transportadora (soft delete)' })
  inativar(
    @Param('id') id: string,
    @Request() req: { user: { sub: string }; ip?: string; get: (h: string) => string | undefined },
  ) {
    const ip = req.ip || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    return this.service.inativar(id, req.user.sub, ip, userAgent);
  }
}
