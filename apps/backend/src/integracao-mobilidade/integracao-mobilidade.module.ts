import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';
import { JwtModule } from '@nestjs/jwt';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { PrismaModule } from '../prisma/prisma.module';
import { IntegracaoApiV1ClienteCatalogoController } from './controllers/integracao-api-v1-cliente.controller';
import { IntegracaoApiV1FinanceiroController } from './controllers/integracao-api-v1-financeiro.controller';
import { IntegracaoApiV1FiscalController } from './controllers/integracao-api-v1-fiscal.controller';
import { IntegracaoApiV1OperacionalController } from './controllers/integracao-api-v1-operacional.controller';
import { IntegracaoClienteApiController } from './controllers/integracao-cliente-api.controller';
import { IntegracaoFinanceiraWebhookController } from './controllers/integracao-financeira-webhook.controller';
import { IntegracaoIotController } from './controllers/integracao-iot.controller';
import { IntegracaoVisaoController } from './controllers/integracao-visao.controller';
import { IntegracaoWebhookIngressController } from './controllers/integracao-webhook-ingress.controller';
import { MobileOperacionalController } from './controllers/mobile-operacional.controller';
import { ClienteApiAuthGuard } from './guards/cliente-api-auth.guard';
import { IntegracaoInternoGuard } from './guards/integracao-interno.guard';
import { IntegracaoIpAllowlistGuard } from './guards/integracao-ip-allowlist.guard';
import { MobileOperadorGuard } from './guards/mobile-operador.guard';
import { IntegracaoApiGatewayService } from './services/integracao-api-gateway.service';
import { IntegracaoClienteApiService } from './services/integracao-cliente-api.service';
import { IntegracaoFinanceiraService } from './services/integracao-financeira.service';
import { IntegracaoRateLimitService } from './services/integracao-rate-limit.service';
import { IntegracaoVisaoService } from './services/integracao-visao.service';
import { MobileOperacionalService } from './services/mobile-operacional.service';
import { WebhookDeliveryService } from './services/webhook-delivery.service';
import { IntegracaoApiKeyStore } from './stores/integracao-api-key.store';
import { IntegracaoEventLogStore } from './stores/integracao-event-log.store';
import { IotSensorStore } from './stores/iot-sensor.store';
import { MobileOpsStore } from './stores/mobile-ops.store';
import { WebhookSubscriptionStore } from './stores/webhook-subscription.store';

@Module({
  imports: [
    PrismaModule,
    AuditoriaModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret:
          config.get<string>('secrets.jwtSecret') ?? config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') ?? '1h') as StringValue,
        },
      }),
    }),
  ],
  controllers: [
    IntegracaoApiV1OperacionalController,
    IntegracaoApiV1FinanceiroController,
    IntegracaoApiV1FiscalController,
    IntegracaoApiV1ClienteCatalogoController,
    IntegracaoWebhookIngressController,
    IntegracaoFinanceiraWebhookController,
    IntegracaoClienteApiController,
    MobileOperacionalController,
    IntegracaoVisaoController,
    IntegracaoIotController,
  ],
  providers: [
    IntegracaoApiKeyStore,
    WebhookSubscriptionStore,
    IntegracaoEventLogStore,
    MobileOpsStore,
    IotSensorStore,
    IntegracaoRateLimitService,
    WebhookDeliveryService,
    IntegracaoApiGatewayService,
    IntegracaoClienteApiService,
    IntegracaoFinanceiraService,
    IntegracaoVisaoService,
    MobileOperacionalService,
    ClienteApiAuthGuard,
    IntegracaoIpAllowlistGuard,
    IntegracaoInternoGuard,
    MobileOperadorGuard,
  ],
})
export class IntegracaoMobilidadeModule {}
