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
import { ClientePaginationDto } from '../common/dtos/pagination.dto';
import { CpfCnpjValidationPipe } from '../common/pipes';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ClientesService } from './clientes.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';

@ApiTags('clientes')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Get()
  @Roles(
    Role.ADMIN,
    Role.GERENTE,
    Role.OPERADOR_PORTARIA,
    Role.OPERADOR_GATE,
    Role.OPERADOR_PATIO,
  )
  @Permissions('clientes:ler')
  findAll(@Query() query: ClientePaginationDto) {
    return this.clientesService.findAllPaginated(query);
  }

  @Get(':id')
  @Roles(
    Role.ADMIN,
    Role.GERENTE,
    Role.OPERADOR_PORTARIA,
    Role.OPERADOR_GATE,
    Role.OPERADOR_PATIO,
  )
  @Permissions('clientes:ler')
  findOne(@Param('id') id: string) {
    return this.clientesService.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('clientes:criar')
  create(@Body(CpfCnpjValidationPipe) dto: CreateClienteDto, @CurrentUser() user: AuthUser) {
    return this.clientesService.create(dto, user.id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('clientes:atualizar')
  update(@Param('id') id: string, @Body() dto: UpdateClienteDto, @CurrentUser() user: AuthUser) {
    return this.clientesService.update(id, dto, user.id);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('clientes:excluir')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.clientesService.remove(id, user.id);
  }
}
