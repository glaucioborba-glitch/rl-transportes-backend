import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { SolicitacaoPaginationDto } from '../common/dtos/pagination.dto';
import { Iso6346ValidationPipe, MercosulPlateValidationPipe } from '../common/pipes';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AddUnidadeSolicitacaoDto } from './dto/add-unidade-solicitacao.dto';
import { CreatePortariaDto } from './dto/create-portaria.dto';
import { CreateSolicitacaoDto } from './dto/create-solicitacao.dto';
import { UpdateSolicitacaoDto } from './dto/update-solicitacao.dto';
import { SolicitacoesService } from './solicitacoes.service';

@ApiTags('solicitacoes')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Controller('solicitacoes')
export class SolicitacoesController {
  constructor(private readonly solicitacoesService: SolicitacoesService) {}

  @Get()
  @Roles(
    Role.ADMIN,
    Role.GERENTE,
    Role.OPERADOR_PORTARIA,
    Role.OPERADOR_GATE,
    Role.OPERADOR_PATIO,
    Role.CLIENTE,
  )
  @Permissions('solicitacoes:ler')
  findAll(@Query() query: SolicitacaoPaginationDto) {
    return this.solicitacoesService.findAllPaginated(query, {
      clienteId: query.clienteId,
      status: query.status,
    });
  }

  @Get(':id')
  @Roles(
    Role.ADMIN,
    Role.GERENTE,
    Role.OPERADOR_PORTARIA,
    Role.OPERADOR_GATE,
    Role.OPERADOR_PATIO,
    Role.CLIENTE,
  )
  @Permissions('solicitacoes:ler')
  findOne(@Param('id') id: string) {
    return this.solicitacoesService.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_PORTARIA)
  @Permissions('solicitacoes:criar')
  create(@Body() dto: CreateSolicitacaoDto, @CurrentUser() user: AuthUser) {
    return this.solicitacoesService.create(dto, user.id);
  }

  @Post('unidades')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('solicitacoes:criar')
  addContainer(
    @Body(Iso6346ValidationPipe) dto: AddUnidadeSolicitacaoDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.solicitacoesService.addContainer(dto, user.id);
  }

  @Post('portaria')
  @Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_PORTARIA)
  @Permissions('solicitacoes:portaria')
  registerPortaria(
    @Body(MercosulPlateValidationPipe) dto: CreatePortariaDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.solicitacoesService.registerPortaria(dto, user.id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_PORTARIA, Role.OPERADOR_GATE)
  @Permissions('solicitacoes:atualizar')
  update(@Param('id') id: string, @Body() dto: UpdateSolicitacaoDto, @CurrentUser() user: AuthUser) {
    return this.solicitacoesService.update(id, dto, user.id);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('solicitacoes:excluir')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.solicitacoesService.remove(id, user.id);
  }
}
