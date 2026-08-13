import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EventoGatilhoTarifa, Role, StatusContainerTarifa, TipoContainerTarifa } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { BillingEngineService } from './billing-engine.service';
import { BillingRuleEngineService } from './billing-rule-engine.service';

class CreateTabelaPrecoDto {
  @IsString()
  tenantId!: string;

  @IsString()
  @MinLength(2)
  nome!: string;
}

class CreateRegraDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsEnum(EventoGatilhoTarifa)
  eventoGatilho!: EventoGatilhoTarifa;

  @IsOptional()
  @IsEnum(TipoContainerTarifa)
  tipoContainer?: TipoContainerTarifa;

  @IsOptional()
  @IsEnum(StatusContainerTarifa)
  statusContainer?: StatusContainerTarifa;

  @IsNumber()
  valor!: number;

  @IsOptional()
  @IsNumber()
  diasFreeTime?: number;
}

class SimularDto {
  @IsNumber()
  diasArmazenados!: number;

  @IsOptional()
  @IsString()
  tamanho?: string;

  @IsOptional()
  @IsString()
  tipo?: string;

  @IsOptional()
  refrigerado?: boolean;
}

const ROLES = [Role.ADMIN, Role.GERENTE, Role.SUPER_ADMIN];

@ApiTags('billing-engine')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(...ROLES)
@Controller('billing-engine')
export class BillingEngineController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: BillingEngineService,
    private readonly ruleEngine: BillingRuleEngineService,
  ) {}

  @Get('tabelas/:tenantId')
  listTabelas(@Param('tenantId') tenantId: string) {
    return this.prisma.tabelaPreco.findMany({
      where: { tenantId },
      include: { regras: { where: { ativa: true } } },
      orderBy: { nome: 'asc' },
    });
  }

  @Post('tabelas')
  createTabela(@Body() dto: CreateTabelaPrecoDto) {
    return this.prisma.tabelaPreco.create({
      data: { tenantId: dto.tenantId, nome: dto.nome.trim() },
    });
  }

  @Post('tabelas/:tabelaId/regras')
  createRegra(@Param('tabelaId') tabelaId: string, @Body() dto: CreateRegraDto) {
    return this.prisma.regraTarifaria.create({
      data: {
        tabelaPrecoId: tabelaId,
        nome: dto.nome?.trim() || null,
        eventoGatilho: dto.eventoGatilho,
        tipoContainer: dto.tipoContainer ?? TipoContainerTarifa.TODOS,
        statusContainer: dto.statusContainer ?? StatusContainerTarifa.AMBOS,
        valor: dto.valor,
        diasFreeTime: dto.diasFreeTime ?? 0,
      },
    });
  }

  @Post('simular/:clienteId')
  @ApiOperation({ summary: 'Simula cobrança com rule engine do cliente' })
  async simular(@Param('clienteId') clienteId: string, @Body() dto: SimularDto) {
    const pricing = await this.ruleEngine.resolvePricingForCliente(clienteId);
    const gateInAt = new Date();
    gateInAt.setUTCDate(gateInAt.getUTCDate() - dto.diasArmazenados);
    const evaluation = await this.ruleEngine.evaluateForContainerCycle({
      gateInAt,
      asOf: new Date(),
      regras: pricing.regras,
      container: {
        tamanho: dto.tamanho ?? '40',
        tipo: dto.tipo ?? 'DRY',
        refrigerado: dto.refrigerado ?? false,
      },
      fase: 'GATE_OUT',
      clienteId,
    });
    return {
      total: evaluation.valorTotal,
      source: pricing.source,
      items: evaluation.items,
      diasNoPatio: evaluation.diasNoPatio,
      diasFaturaveis: evaluation.diasFaturaveis,
    };
  }
}
