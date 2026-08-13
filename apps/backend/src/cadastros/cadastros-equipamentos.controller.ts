import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CadastrosEquipamentosService } from './cadastros-equipamentos.service';
import { CadastrosEquipamentoFormDto } from './dto/cadastros-equipamento-form.dto';
import { CadastrosEquipamentoQueryDto } from './dto/cadastros-equipamento-query.dto';

const CADASTROS_ROLES = [
  Role.ADMIN,
  Role.GERENTE,
  Role.OPERADOR_GATE,
  Role.OPERADOR_PORTARIA,
  Role.OPERADOR_PATIO,
] as const;

@ApiTags('cadastros')
@ApiBearerAuth('access-token')
@Controller('v2/cadastros/equipamentos')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Roles(...CADASTROS_ROLES)
export class CadastrosEquipamentosController {
  constructor(private readonly service: CadastrosEquipamentosService) {}

  @Get()
  @ApiOperation({ summary: 'Listar equipamentos' })
  list(@Query() query: CadastrosEquipamentoQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.list(query, user);
  }

  @Get(':id/auditoria')
  @Permissions('auditoria:ler')
  @ApiOperation({ summary: 'Histórico de alterações' })
  auditoria(@Param('id') id: string) {
    return this.service.listAuditoria(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe do equipamento' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.GERENTE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Criar equipamento' })
  create(
    @Body() dto: CadastrosEquipamentoFormDto,
    @Request() req: { user: { sub: string }; ip?: string; get: (h: string) => string | undefined },
  ) {
    const ip = req.ip || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    return this.service.create(dto, req.user.sub, ip, userAgent);
  }

  @Put(':id')
  @Roles(Role.ADMIN, Role.GERENTE)
  @ApiOperation({ summary: 'Atualizar equipamento' })
  update(
    @Param('id') id: string,
    @Body() dto: CadastrosEquipamentoFormDto,
    @Request() req: { user: { sub: string }; ip?: string; get: (h: string) => string | undefined },
  ) {
    const ip = req.ip || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    return this.service.update(id, dto, req.user.sub, ip, userAgent);
  }
}
