import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { ClientesService } from './clientes.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { CpfCnpjValidationPipe } from '../common/pipes/cpf-cnpj-validation.pipe';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';

@ApiTags('clientes')
@ApiBearerAuth('access-token')
@Controller('clientes')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Post()
  @Roles('ADMIN', 'GERENTE')
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
  @Roles('ADMIN', 'GERENTE', 'CLIENTE')
  @Permissions('clientes:ler')
  @ApiOperation({ summary: 'Listar clientes com paginação' })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.clientesService.findAll(page, limit);
  }

  @Get(':id')
  @Roles('ADMIN', 'GERENTE', 'CLIENTE')
  @Permissions('clientes:ler')
  @ApiOperation({ summary: 'Obter cliente por ID' })
  async findOne(@Param('id') id: string) {
    return this.clientesService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'GERENTE')
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
  @Roles('ADMIN')
  @Permissions('clientes:excluir')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deletar cliente (soft delete)' })
  async remove(@Param('id') id: string, @Request() req: any) {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';

    return this.clientesService.remove(id, req.user.sub, ip, userAgent);
  }
}