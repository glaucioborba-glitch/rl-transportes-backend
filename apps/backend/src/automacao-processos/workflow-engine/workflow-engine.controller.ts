import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { WorkflowEngineService } from './workflow-engine.service';
import type { WorkflowDef } from '../automacao.types';
import {
  AtualizarWorkflowAtivoDto,
  AutomacaoEventoInternoDocDto,
  CriarWorkflowDto,
  TestarWorkflowDto,
} from '../dto/workflow-automacao.dto';

@ApiTags('automacao-workflows')
@ApiBearerAuth('access-token')
@Controller('automacao/workflows')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_PORTARIA, Role.OPERADOR_GATE, Role.OPERADOR_PATIO)
@ApiExtraModels(AutomacaoEventoInternoDocDto)
export class WorkflowEngineController {
  constructor(private readonly engine: WorkflowEngineService) {}

  @Post()
  @ApiOperation({
    summary: 'Criar ou atualizar workflow',
    description:
      '**RBAC:** `ADMIN`. Eventos de disparo alinhados ao barramento da Fase 14 (`gate.registrado`, `patio.movimentado`, `boleto.pago`, etc.). Ações são **simuladas** — sem efeitos destrutivos em produção nesta fase.',
  })
  @ApiBody({ type: CriarWorkflowDto })
  @ApiCreatedResponse({ description: 'Workflow persistido em memória.' })
  @Permissions('automacao:admin')
  criar(@Body() body: CriarWorkflowDto) {
    return this.engine.criarOuAtualizar({
      id: body.id,
      nome: body.nome,
      eventoDisparo: body.eventoDisparo,
      condicoes: body.condicoes,
      acoes: body.acoes,
      prioridade: Math.min(5, Math.max(1, body.prioridade)) as WorkflowDef['prioridade'],
      ativo: body.ativo ?? true,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Listar workflows' })
  @Permissions('automacao:read')
  listar() {
    return this.engine.listar();
  }

  @Post('testar')
  @ApiOperation({
    summary: 'Simular workflow',
    description:
      'Executa matching de condições e ações em modo **não destrutivo**. `rascunho` opcional evita usar workflows persistidos.',
  })
  @Permissions('automacao:workflow:test')
  testar(@Body() body: TestarWorkflowDto) {
    return this.engine.testar({
      eventoDisparo: body.eventoDisparo,
      payload: body.payload,
      rascunho: body.rascunho
        ? {
            nome: body.rascunho.nome,
            eventoDisparo: body.rascunho.eventoDisparo,
            condicoes: body.rascunho.condicoes,
            acoes: body.rascunho.acoes,
            prioridade: Math.min(5, Math.max(1, body.rascunho.prioridade ?? 3)) as WorkflowDef['prioridade'],
            ativo: body.rascunho.ativo ?? true,
          }
        : undefined,
    });
  }

  @Patch(':id/ativo')
  @ApiOperation({ summary: 'Ativar/desativar workflow', description: '**RBAC:** `ADMIN` ou `GERENTE`.' })
  @Permissions('automacao:toggle')
  toggle(@Param('id', ParseUUIDPipe) id: string, @Body() body: AtualizarWorkflowAtivoDto) {
    const w = this.engine.definirAtivo(id, body.ativo);
    if (!w) return { ok: false, message: 'workflow_nao_encontrado' };
    return w;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover workflow', description: '**RBAC:** somente `ADMIN`.' })
  @Permissions('automacao:admin')
  remover(@Param('id', ParseUUIDPipe) id: string) {
    const ok = this.engine.remover(id);
    return { ok };
  }
}
