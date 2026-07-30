import {
  Body,
  Controller,
  Delete,
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
import { CadastrosColaboradoresService } from './cadastros-colaboradores.service';
import { AniversariosService } from './aniversarios.service';
import { CadastrosColaboradorFormDto } from './dto/cadastros-colaborador-form.dto';
import { CadastrosColaboradorQueryDto } from './dto/cadastros-colaborador-query.dto';
import { CreateFamiliarDto, UpdateFamiliarDto } from './dto/colaborador-familiar.dto';

const CADASTROS_ROLES = [Role.ADMIN, Role.GERENTE] as const;

@ApiTags('cadastros')
@ApiBearerAuth('access-token')
@Controller('v2/cadastros/colaboradores')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Roles(...CADASTROS_ROLES)
export class CadastrosColaboradoresController {
  constructor(
    private readonly service: CadastrosColaboradoresService,
    private readonly aniversarios: AniversariosService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar colaboradores (cadastros MDM)' })
  list(@Query() query: CadastrosColaboradorQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.list(query, user);
  }

  @Get('aniversarios/proximos')
  @ApiOperation({ summary: 'Próximos aniversários de familiares (agenda RH)' })
  proximosAniversarios(@Query('dias') dias?: string) {
    const n = dias ? parseInt(dias, 10) : 30;
    return this.aniversarios.getProximosAniversarios(Number.isFinite(n) && n > 0 ? n : 30);
  }

  @Get('check-cpf/:cpf')
  @ApiOperation({ summary: 'Verificar duplicidade de CPF' })
  checkCpf(@Param('cpf') cpf: string, @Query('excludeId') excludeId?: string) {
    return this.service.checkCpf(cpf, excludeId);
  }

  @Get('aux/gestores')
  @ApiOperation({ summary: 'Lista de gestores para select' })
  gestores() {
    return this.service.listGestores();
  }

  @Get('aux/centros-custo')
  @ApiOperation({ summary: 'Lista de centros de custo' })
  centrosCusto() {
    return this.service.listCentrosCusto();
  }

  @Get(':id/auditoria')
  @Permissions('auditoria:ler')
  @ApiOperation({ summary: 'Histórico de alterações' })
  auditoria(@Param('id') id: string) {
    return this.service.listAuditoria(id);
  }

  @Get(':id/familiares')
  @ApiOperation({ summary: 'Listar familiares do colaborador' })
  listFamiliares(@Param('id') id: string) {
    return this.service.listFamiliares(id);
  }

  @Post(':id/familiares')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Adicionar familiar' })
  addFamiliar(@Param('id') id: string, @Body() dto: CreateFamiliarDto) {
    return this.service.addFamiliar(id, dto);
  }

  @Patch(':id/familiares/:familiarId')
  @ApiOperation({ summary: 'Atualizar familiar' })
  updateFamiliar(@Param('familiarId') familiarId: string, @Body() dto: UpdateFamiliarDto) {
    return this.service.updateFamiliar(familiarId, dto);
  }

  @Patch(':id/familiares/:familiarId/remover')
  @ApiOperation({ summary: 'Remover familiar (soft delete)' })
  removeFamiliar(@Param('familiarId') familiarId: string) {
    return this.service.removeFamiliar(familiarId);
  }

  @Delete(':id/familiares/:familiarId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Excluir familiar permanentemente' })
  deleteFamiliar(@Param('familiarId') familiarId: string) {
    return this.service.deleteFamiliar(familiarId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe do colaborador' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Criar colaborador' })
  create(
    @Body() dto: CadastrosColaboradorFormDto,
    @Request() req: { user: { sub: string }; ip?: string; get: (h: string) => string | undefined },
  ) {
    const ip = req.ip || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    return this.service.create(dto, req.user.sub, ip, userAgent);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar colaborador' })
  update(
    @Param('id') id: string,
    @Body() dto: CadastrosColaboradorFormDto,
    @Request() req: { user: { sub: string }; ip?: string; get: (h: string) => string | undefined },
  ) {
    const ip = req.ip || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    return this.service.update(id, dto, req.user.sub, ip, userAgent);
  }

  @Patch(':id/inativar')
  @ApiOperation({ summary: 'Inativar colaborador (soft delete)' })
  inativar(
    @Param('id') id: string,
    @Request() req: { user: { sub: string }; ip?: string; get: (h: string) => string | undefined },
  ) {
    const ip = req.ip || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    return this.service.inativar(id, req.user.sub, ip, userAgent);
  }
}
