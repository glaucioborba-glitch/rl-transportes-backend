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
import { CadastrosMotoristasService } from './cadastros-motoristas.service';
import { CadastrosMotoristaFormDto } from './dto/cadastros-motorista-form.dto';
import { CadastrosMotoristaQueryDto } from './dto/cadastros-motorista-query.dto';

const CADASTROS_ROLES = [Role.ADMIN, Role.GERENTE] as const;

@ApiTags('cadastros')
@ApiBearerAuth('access-token')
@Controller('v2/cadastros/motoristas')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Roles(...CADASTROS_ROLES)
export class CadastrosMotoristasController {
  constructor(private readonly service: CadastrosMotoristasService) {}

  @Get()
  @ApiOperation({ summary: 'Listar motoristas (cadastros MDM)' })
  list(@Query() query: CadastrosMotoristaQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.list(query, user);
  }

  @Get('check-cpf/:cpf')
  @ApiOperation({ summary: 'Verificar duplicidade de CPF' })
  checkCpf(@Param('cpf') cpf: string, @Query('excludeId') excludeId?: string) {
    return this.service.checkCpf(cpf, excludeId);
  }

  @Get(':id/auditoria')
  @Permissions('auditoria:ler')
  @ApiOperation({ summary: 'Histórico de alterações' })
  auditoria(@Param('id') id: string) {
    return this.service.listAuditoria(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe do motorista' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Criar motorista' })
  create(
    @Body() dto: CadastrosMotoristaFormDto,
    @Request() req: { user: { sub: string }; ip?: string; get: (h: string) => string | undefined },
  ) {
    const ip = req.ip || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    return this.service.create(dto, req.user.sub, ip, userAgent);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar motorista' })
  update(
    @Param('id') id: string,
    @Body() dto: CadastrosMotoristaFormDto,
    @Request() req: { user: { sub: string }; ip?: string; get: (h: string) => string | undefined },
  ) {
    const ip = req.ip || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    return this.service.update(id, dto, req.user.sub, ip, userAgent);
  }

  @Patch(':id/inativar')
  @ApiOperation({ summary: 'Inativar motorista (soft delete)' })
  inativar(
    @Param('id') id: string,
    @Request() req: { user: { sub: string }; ip?: string; get: (h: string) => string | undefined },
  ) {
    const ip = req.ip || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    return this.service.inativar(id, req.user.sub, ip, userAgent);
  }
}
