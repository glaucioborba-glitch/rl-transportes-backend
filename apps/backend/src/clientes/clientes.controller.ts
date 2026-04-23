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
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ClientePaginationDto } from '../common/dtos/pagination.dto';
import { ClientesService } from './clientes.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { CpfCnpjValidationPipe } from '../common/pipes/cpf-cnpj-validation.pipe';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';

@ApiTags('clientes')
@ApiBearerAuth('access-token')
@Controller('clientes')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Post()
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('clientes:criar')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Criar novo cliente' })
  async create(
    @Body(CpfCnpjValidationPipe) createClienteDto: CreateClienteDto,
    @Request() req: any,
  ) {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';

    return this.clientesService.create(
      createClienteDto,
      req.user.sub,
      ip,
      userAgent,
    );
  }

  @Get()
  @Roles(Role.ADMIN, Role.GERENTE, Role.CLIENTE)
  @Permissions('clientes:ler')
  @ApiOperation({ summary: 'Listar clientes com paginação e filtro de busca' })
  async findAll(
    @Query() query: ClientePaginationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.clientesService.findAllPaginated(query, user);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.GERENTE, Role.CLIENTE)
  @Permissions('clientes:ler')
  @ApiOperation({ summary: 'Obter cliente por ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.clientesService.findOne(id, user);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('clientes:atualizar')
  @ApiOperation({ summary: 'Atualizar cliente' })
  async update(
    @Param('id') id: string,
    @Body(CpfCnpjValidationPipe) updateClienteDto: UpdateClienteDto,
    @Request() req: any,
  ) {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';

    return this.clientesService.update(
      id,
      updateClienteDto,
      req.user.sub,
      ip,
      userAgent,
    );
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @Permissions('clientes:excluir')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deletar cliente (soft delete)' })
  async remove(@Param('id') id: string, @Request() req: any) {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';

    return this.clientesService.remove(id, req.user.sub, ip, userAgent);
  }
}