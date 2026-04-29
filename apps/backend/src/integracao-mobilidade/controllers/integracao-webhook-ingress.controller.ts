import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { IntegracaoTipoEvento } from '../integracao-events.constants';
import { DispatchEventoInternoDto, RegisterWebhookDto } from '../dto/integracao-webhooks.dto';
import { IntegracaoInternoGuard } from '../guards/integracao-interno.guard';
import { IntegracaoIpAllowlistGuard } from '../guards/integracao-ip-allowlist.guard';
import { WebhookDeliveryService } from '../services/webhook-delivery.service';
import { WebhookSubscriptionStore } from '../stores/webhook-subscription.store';

@ApiTags('integracao-webhooks')
@ApiBearerAuth('access-token')
@Controller('integracao')
export class IntegracaoWebhookIngressController {
  constructor(
    private readonly subs: WebhookSubscriptionStore,
    private readonly delivery: WebhookDeliveryService,
  ) {}

  @Post('webhooks')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.GERENTE)
  @ApiOperation({
    summary: 'Registrar webhook corporativo',
    description:
      'Destinos HTTPS que recebem eventos com cabeçalho X-Integracao-Signature (HMAC-SHA256 do corpo JSON). Entrega com até 3 tentativas.',
  })
  @ApiCreatedResponse({ description: 'Assinatura criada' })
  registrar(@Body() dto: RegisterWebhookDto) {
    const sub = this.subs.register({
      url: dto.url,
      secret: dto.secret,
      eventos: dto.eventos as IntegracaoTipoEvento[],
    });
    return { id: sub.id, url: sub.url, eventos: sub.eventos, createdAt: sub.createdAt };
  }

  @Post('eventos')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(IntegracaoIpAllowlistGuard, IntegracaoInternoGuard)
  @ApiOperation({
    summary: 'Disparar evento interno (barramento)',
    description:
      'Protegido por header X-Integracao-Interno. Encaminha para webhooks inscritos e registra auditoria quando configurado.',
  })
  async disparar(@Body() dto: DispatchEventoInternoDto) {
    const results = await this.delivery.dispatch({
      tipo: dto.tipo as IntegracaoTipoEvento,
      payload: dto.payload,
      clienteId: dto.clienteId,
      correlationId: dto.correlationId,
    });
    return { aceito: true, entregas: results };
  }
}
