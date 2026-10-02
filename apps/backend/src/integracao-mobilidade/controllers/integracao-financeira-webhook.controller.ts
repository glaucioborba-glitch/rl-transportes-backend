import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { canonicalPagamentoPayload } from '../common/integracao-finance.canonical';
import { verifyWebhookSignature } from '../common/webhook-signature.util';
import { PagamentoWebhookDto } from '../dto/pagamento-webhook.dto';
import { IntegracaoIpAllowlistGuard } from '../guards/integracao-ip-allowlist.guard';
import { IntegracaoFinanceiraService } from '../services/integracao-financeira.service';

@ApiTags('integracao-financeira')
@ApiHeader({
  name: 'X-Integracao-Signature',
  required: true,
  description: 'HMAC-SHA256 (hex) de canonicalPagamentoPayload (INTEGRACAO_FINANCE_WEBHOOK_SECRET).',
})
@Controller('integracao/pagamentos')
export class IntegracaoFinanceiraWebhookController {
  constructor(
    private readonly finance: IntegracaoFinanceiraService,
    private readonly config: ConfigService,
  ) {}

  @Post('webhook')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(IntegracaoIpAllowlistGuard)
  @ApiOperation({
    summary: 'Webhook de pagamento (PIX/boleto)',
    description: 'HMAC-SHA256 obrigatório. Sem secret configurado a API recusa o evento.',
  })
  async webhook(
    @Body() dto: PagamentoWebhookDto,
    @Headers('x-integracao-signature') sig?: string,
  ) {
    const secret = this.config.get<string>('INTEGRACAO_FINANCE_WEBHOOK_SECRET')?.trim();
    if (!secret) {
      throw new ServiceUnavailableException('Webhook financeiro sem INTEGRACAO_FINANCE_WEBHOOK_SECRET.');
    }
    const canonical = canonicalPagamentoPayload(dto);
    const ok = Boolean(sig && verifyWebhookSignature(secret, canonical, sig));
    if (!ok) throw new UnauthorizedException('Assinatura invalida.');
    return this.finance.processWebhook(dto);
  }
}
