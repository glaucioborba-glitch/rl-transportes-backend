import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsArray, IsDateString, IsString, ArrayMinSize } from 'class-validator';
import { ModoFaturamentoCliente, Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { FaturaPacoteService } from './fatura-pacote.service';

class EmitirFaturaPacoteDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  faturaIds!: string[];
}

class AgendarFaturaPacoteDto extends EmitirFaturaPacoteDto {
  @IsDateString()
  agendadoPara!: string;
}

const GESTAO = [Role.ADMIN, Role.GERENTE, Role.SUPER_ADMIN] as const;

@ApiTags('fatura-pacote')
@ApiBearerAuth('access-token')
@Controller('financeiro/faturas')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Roles(...GESTAO)
@Permissions('cadastro-financeiro:analisar')
export class FaturaPacoteController {
  constructor(private readonly service: FaturaPacoteService) {}

  @Get()
  @ApiOperation({ summary: 'Fila a faturar por cliente + Faturas enviadas' })
  listar() {
    return this.service.listarFila();
  }

  @Get('pacotes/:id')
  @ApiOperation({ summary: 'Fatura FAT emitida, com composição de cada ID' })
  obterPacote(@Param('id') id: string) {
    return this.service.obterPacote(id);
  }

  @Get('clientes/:clienteId')
  @ApiOperation({ summary: 'IDs a faturar do cliente, com composição de valores' })
  obter(@Param('clienteId') clienteId: string) {
    return this.service.obterCliente(clienteId);
  }

  @Post('clientes/:clienteId/emitir')
  @ApiOperation({ summary: 'Emitir Fatura FAT com os IDs marcados (ID inteiro)' })
  emitir(@Param('clienteId') clienteId: string, @Body() body: EmitirFaturaPacoteDto) {
    return this.service.emitir(clienteId, body.faturaIds, ModoFaturamentoCliente.MANUAL);
  }

  @Post('clientes/:clienteId/agendar')
  @ApiOperation({ summary: 'Agendar emissão da Fatura FAT (data/hora, como o automático)' })
  agendar(@Param('clienteId') clienteId: string, @Body() body: AgendarFaturaPacoteDto) {
    return this.service.agendar(clienteId, body.faturaIds, body.agendadoPara);
  }
}
