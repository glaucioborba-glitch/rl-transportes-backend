import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import * as compression from 'compression';
import type { Request } from 'express';
import rateLimit from 'express-rate-limit';
import { AppModule } from './app.module';
import { PlataformaPublicSurfaceModule } from './plataforma-integracao/plataforma-public-surface.module';
import { MobileHubModule } from './mobile-hub/mobile-hub.module';
import { CockpitOperacoesModule } from './cockpit-operacoes/cockpit-operacoes.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  const logger = new Logger('Bootstrap');

  if (process.env.TRUST_PROXY === '1') {
    const httpServer = app.getHttpAdapter().getInstance() as { set?: (k: string, v: unknown) => void };
    httpServer.set?.('trust proxy', 1);
  }

  const rateMax = Math.max(1, parseInt(process.env.RATE_LIMIT_MAX || '100', 10) || 100);
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: rateMax,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        message:
          'Muitas requisições de seu IP, tente novamente após 15 minutos.',
      },
      skip: (req: Request) => {
        const p = (req as Request & { path?: string }).path || req.url?.split('?')[0] || '';
        return (
          p === '/health' ||
          p.endsWith('/health') ||
          p.startsWith('/public/') ||
          p.startsWith('/marketplace/') ||
          p.startsWith('/gateway/') ||
          p.startsWith('/mobile/')
        );
      },
    }),
  );

  // CORS: origens explícitas; cabeçalhos mínimos + rastreio (request id)
  app.enableCors({
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map((o) => o.trim()).filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-Id',
      'X-Request-ID',
      'X-Api-Key',
      'X-Public-Api-Key',
      'X-Public-Api-Secret',
      'X-Tenant-ID',
      'X-Integracao-Interno',
      'X-Integracao-Signature',
      'X-Mobile-Critical-Pin',
    ],
  });

  // Compressão de respostas
  app.use(compression());

  // Validação global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      stopAtFirstError: true,
    }),
  );

  // Swagger/OpenAPI documentação
  const config = new DocumentBuilder()
    .setTitle('RL Transportes - Backend API')
    .setDescription(
      'API para Gerenciamento de Terminal de Apoio Logístico - Armazenagem de Containers',
    )
    .setVersion('1.0.0')
    .setContact(
      'RL Transportes',
      'https://rl-transportes.com',
      'contato@rl-transportes.com',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        in: 'header',
        name: 'Authorization',
        description: 'JWT **mobile** (login em `POST /mobile/v1/auth/login`).',
      },
      'mobile-bearer',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        in: 'header',
        name: 'Authorization',
        description: 'JWT Access Token (API corporativa)',
      },
      'access-token',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'X-Api-Key',
        description:
          'Chave B2B (tracking cliente-api). Configure INTEGRACAO_API_KEYS=key|clienteUuid na env.',
      },
      'api-key',
    )
    .addTag('auth', 'Autenticação')
    .addTag('health', 'Disponibilidade')
    .addTag('clientes', 'Gerenciamento de Clientes')
    .addTag('solicitacoes', 'Gerenciamento de Solicitações')
    .addTag('auditoria', 'Auditoria e rastreabilidade')
    .addTag('faturamento', 'Faturamento, NFS-e e boletos')
    .addTag('nfse', 'NFS-e IPM / Atende.Net')
    .addTag('portal-cliente', 'Portal do cliente')
    .addTag('relatorios', 'Relatórios operacional e financeiro')
    .addTag('dashboard', 'Dashboard operacional em tempo real (supervisão de terminal)')
    .addTag('dashboard-financeiro', 'Dashboard financeiro executivo (gestão)')
    .addTag(
      'dashboard-performance',
      'Dashboard de performance operacional (custo × margem × produtividade)',
    )
    .addTag(
      'comercial-pricing',
      'Inteligência comercial e pricing (ABC, elasticidade, simulador, recomendações)',
    )
    .addTag(
      'ia-operacional',
      'Inteligência operacional (previsão de gargalos, ciclo, OCR Gate auxiliar, pátio, produtividade)',
    )
    .addTag(
      'simulador-terminal',
      'Simulador estratégico de capacidade, saturação, expansão e cenários What-If',
    )
    .addTag(
      'planejamento-estrategico',
      'Planejamento de capacidade, OPEX/CAPEX e forecast financeiro executivo',
    )
    .addTag(
      'planejamento-pessoal',
      'Planejamento de pessoal: headcount, OPEX RH, turnos, cenários What-If e contratação',
    )
    .addTag(
      'fiscal-governanca',
      'Governança fiscal: conciliação NFS-e × faturamento × boletos, auditoria inteligente e painel executivo',
    )
    .addTag(
      'financeiro-conciliacao',
      'Conciliação bancária (OFX/CSV), fluxo de caixa, previsibilidade e tesouraria (extratos em memória até migração)',
    )
    .addTag(
      'tesouraria',
      'Tesouraria e AP (fornecedores, despesas, contratos, agenda, impacto em caixa e painel — persistência em memória até migração Prisma)',
    )
    .addTag(
      'folha-rh',
      'RH Financeiro: folha, benefícios, presenças, centro de custo por turno e projeções — memória até migração; fórmulas documentadas nos endpoints',
    )
    .addTag(
      'rh-performance',
      'RH estratégico: avaliações, KPIs, OKR, BSC, trilhas de treinamento e painel. RBAC: ADMIN/GERENTE; supervisor via RH_PERF_SUPERVISOR_EMAILS (exceto POST /okr); OPERADOR/CLIENTE 403. Integrações por proxies RH_PERF_* sem alterar outros módulos.',
    )
    .addTag(
      'grc-compliance',
      'Governança, risco e conformidade (GRC): riscos, controles, auditoria inteligente read-only, gap ISO/OEA/ISPS, planos 5W2H e dashboard. RBAC: ADMIN/GERENTE total; supervisor via GRC_SUPERVISOR_EMAILS (POST /controles só ADMIN/GERENTE); OPERADOR_* e CLIENTE 403.',
    )
    .addTag(
      'integracao-api-gateway',
      'API Gateway corporativo v1 (`/api/v1`): envelopes padronizados; apenas ADMIN/GERENTE.',
    )
    .addTag(
      'integracao-webhooks',
      'Webhooks e barramento interno (`/integracao/webhooks`, `/integracao/eventos`). HMAC-SHA256 e retries.',
    )
    .addTag(
      'integracao-cliente-api',
      'Tracking B2B (`/cliente-api`): API Key ou JWT CLIENTE; rate limit dedicado.',
    )
    .addTag(
      'integracao-mobile',
      'Mobilidade operacional (`/mobile`): somente OPERADOR_* com payloads minimos.',
    )
    .addTag(
      'integracao-financeira',
      'Webhook de pagamentos (`/integracao/pagamentos/webhook`): opcionalmente assinado.',
    )
    .addTag(
      'integracao-visao',
      'OCR/camera preparatorio (`/integracao/ocr`): ADMIN/GERENTE.',
    )
    .addTag(
      'integracao-iot',
      'Sensores IoT (`/integracao/iot/sensor`): header interno + IP allowlist opcional.',
    )
    .addTag(
      'observabilidade',
      'Observabilidade 360º: logs estruturados, métricas Prometheus, tracing sintético, health detalhado, alertas em memória e dashboard. RBAC: ADMIN total; GERENTE leitura (POST /alertas só ADMIN); OPERADOR/CLIENTE 403.',
    )
    .addTag(
      'ia-preditiva',
      'Inteligência preditiva local (estatística): demanda, ocupação de pátio, produtividade UPH, inadimplência scorecard, anomalias heurísticas e pipeline MLOps sem serviços externos. RBAC: ADMIN e GERENTE; OPERADOR_* e CLIENTE 403.',
    )
    .addTag(
      'datahub',
      '**Fase 17 — Data Lake RAW**, catálogo DW Kimball + linhas em memória, ETL (extrair→transformar→carregar), DQ, BI consolidado, export JSON/CSV. ' +
        '**RBAC**: `ADMIN` acesso total; `GERENTE` apenas `datahub:dw:read` + `datahub:bi:read`; papéis **TI/Dados** = mesmo `GERENTE` com e-mail em `DATAHUB_TI_EMAILS` (permissões extras lake/ETL/export/quality/obs). `OPERADOR_*` e `CLIENTE` → 403. Sem migrations nem BI externo.',
    )
    .addTag(
      'plataforma-public-v1',
      '**Fase 18** — API pública comercial `GET /public/v1/*`: autenticação `X-Public-Api-Key` + `X-Public-Api-Secret`, throttling por cliente, envelope `{ success, data, meta }`, opcional `X-Tenant-ID`. Read-only; sem migrations.',
    )
    .addTag('plataforma-marketplace', 'Marketplace B2B — catálogo read-only; assinatura via JWT ADMIN em `POST /marketplace/assinaturas`.')
    .addTag('plataforma-marketplace-admin', 'Administração de assinaturas marketplace (JWT).')
    .addTag('plataforma-multi-tenant', 'Multi-tenant simulado em memória — `POST/GET /tenant`, `GET /tenant/:id/config` (JWT).')
    .addTag('plataforma-api-gateway', 'Gateway — `GET /gateway/status`, `GET /gateway/limites` (credenciais públicas).')
    .addTag('plataforma-api-contracts', 'Contratos JSON Schema e webhooks documentados em `GET /api-contracts/v1/...`.')
    .addTag('plataforma-governanca', 'Governança — consumo, estatísticas e segurança (`/plataforma/*`, JWT ADMIN/GERENTE).')
    .addTag('plataforma-admin', 'Provisionamento de API Keys — `/plataforma/admin/api-clients` (JWT ADMIN).')
    .addTag(
      'automacao-workflows',
      '**Fase 19** — Engine de workflows event-driven (`/automacao/workflows`). Ações **simuladas** até migração; disparo via barramento Fase 14. RBAC: criar/excluir `ADMIN`; ativar `GERENTE`; leitura OPERADOR_*.',
    )
    .addTag('automacao-rpa', 'Robôs internos assíncronos (`/automacao/rpa`). Auditoria por job em memória.')
    .addTag('automacao-regras', 'Rule engine if/then (`/automacao/regras`).')
    .addTag('automacao-estados', 'Máquina de estados ISO do terminal (`/automacao/estados`).')
    .addTag('automacao-scheduler', 'Registro de crons corporativos (`/automacao/scheduler`).')
    .addTag('automacao-dashboard', 'Painel executivo de automação (`/automacao/dashboard`).')
    .addTag(
      'cx-portal-iam',
      '**Fase 20** — IAM dedicado (`POST /portal/login`, `/portal/refresh`, `/portal/2fa`). JWT portal separado (`PORTAL_JWT_SECRET`). Papéis `CLIENTE` (Prisma), `FORNECEDOR`/`PARCEIRO` (seed `CX_PORTAL_FORNECEDOR_SEED`). API Key pública **sem** Bearer → 403 nas rotas CX.',
    )
    .addTag(
      'cx-portal-cliente',
      'Portal B2B cliente — `/cliente/portal/*`. Bearer: JWT portal **CLIENTE** ou JWT corporativo **ADMIN/GERENTE** (+ `?clienteId=`).',
    )
    .addTag(
      'cx-portal-fornecedor',
      'Portal fornecedor — `/fornecedor/portal/*`. JWT portal **FORNECEDOR**/**PARCEIRO** ou staff.',
    )
    .addTag('cx-portal-branding', 'White-label — `GET/POST /portal/branding` (POST staff).')
    .addTag('cx-portal-comunicacao', 'Tickets — `/portal/tickets`.')
    .addTag('cx-portal-analytics', 'Analytics de uso — `GET /portal/analytics` (**staff**).')
    .addTag(
      'mobile-hub-auth',
      '**Fase 21** — Login/refresh mobile (`/mobile/v1/auth`). JWT dedicado (`MOBILE_JWT_*`); `deviceId` obrigatório; device binding.',
    )
    .addTag(
      'mobile-hub-operador',
      'App operador — `/mobile/v1/operador/*`. Bearer **mobile-bearer**. Crítico: `X-Mobile-Critical-Pin` quando `MOBILE_CRITICAL_PIN` definido.',
    )
    .addTag('mobile-hub-motorista', 'App motorista — `/mobile/v1/motorista/*`.')
    .addTag('mobile-hub-cliente', 'App cliente — `/mobile/v1/cliente/*`.')
    .addTag('mobile-hub-sync', 'Sync offline — `/mobile/v1/sync/*` (LWW).')
    .addTag('mobile-hub-telemetria', '`POST /mobile/v1/telemetria`.')
    .addTag('mobile-hub-push', 'Push — `/mobile/v1/push/*` (FCM em memória).')
    .addTag(
      'mobile-hub-admin',
      'Staff — `/mobile/v1/admin/*` (JWT corporativo **ADMIN/GERENTE**): telemetria agregada e jobs push.',
    )
    .addTag('mobile-hub-v2', 'Contrato **v2** — `/mobile/v2/status`.')
    .addTag(
      'cockpit-mapa',
      '**Fase 22** — Mapa operacional em tempo real (`/cockpit/mapa/*`). JWT + `COCKPIT_SUPERVISOR_EMAILS` para supervisores.',
    )
    .addTag('cockpit-timeline', 'Linha do tempo operacional e eventos (`/cockpit/timeline/*`).')
    .addTag('cockpit-alertas', 'NOC Alert Center (`/cockpit/alertas*`).')
    .addTag('cockpit-indicadores', 'KPIs e turno (`/cockpit/indicadores*`).')
    .addTag('cockpit-tenant', 'Multi-terminal (`/cockpit/tenant/*`).')
    .addTag('cockpit-automacao', 'Automação read-only (`/cockpit/automacao*`).')
    .addTag('cockpit-telemetria', 'Telemetria mobile (`/cockpit/telemetria/*`).')
    .addTag('cockpit-financeiro', 'Painel fiscal/financeiro sensível (`/cockpit/financeiro/*`).')
    .addTag('cockpit-rh', 'RH operacional proxy (`/cockpit/rh/*`).')
    .addTag('cockpit-executivo', 'Dashboard C-Level (`/cockpit/executivo`).')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs/internal', app, document);
  SwaggerModule.setup('docs', app, document);

  const publicSwagger = new DocumentBuilder()
    .setTitle('RL Transportes — API Pública Comercial')
    .setDescription(
      'Contratos **v1** para parceiros B2B: tracking, SLAs, pátio, NFSe e faturamento **read-only**. ' +
        'Rate-limit individual por API Key (`PLATAFORMA_API_CLIENTS`). Erros: 400, 401, 403, 429. ' +
        'Webhooks: ver `GET /api-contracts/v1/webhooks`.',
    )
    .setVersion('1.0.0')
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'X-Public-Api-Key', description: 'Identificador público da aplicação parceira.' },
      'public-api-key',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'X-Public-Api-Secret',
        description: 'Segredo confidencial (nunca expor em front-end público).',
      },
      'public-api-secret',
    )
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'X-Tenant-ID', description: 'Opcional — tenant lógico; default vem do cadastro da chave.' },
      'tenant-id',
    )
    .addTag('plataforma-public-v1', 'Recursos REST versionados')
    .addTag('plataforma-marketplace', 'Catálogo de serviços digitais')
    .build();

  const publicDocument = SwaggerModule.createDocument(app, publicSwagger, {
    include: [PlataformaPublicSurfaceModule],
  });
  SwaggerModule.setup('docs/public', app, publicDocument);

  const mobileSwagger = new DocumentBuilder()
    .setTitle('RL Transportes — Mobile Hub API')
    .setDescription(
      '**Fase 21** — Contratos levíssimos para apps nativos (operador, motorista, cliente). ' +
        'Base path `/mobile/v1`. Versão reservada `/mobile/v2`. Imagens: **gzip+base64** recomendado no cliente. **`deviceId`** obrigatório no login.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Token retornado por `POST /mobile/v1/auth/login` ou `refresh`.',
      },
      'mobile-bearer',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT corporativo **ADMIN/GERENTE** para `/mobile/v1/admin/*`.',
      },
      'access-token',
    )
    .addTag('mobile-hub-auth', 'Autenticação mobile')
    .addTag('mobile-hub-operador', 'Operador')
    .addTag('mobile-hub-motorista', 'Motorista')
    .addTag('mobile-hub-cliente', 'Cliente')
    .addTag('mobile-hub-sync', 'Sincronização offline')
    .addTag('mobile-hub-telemetria', 'Telemetria')
    .addTag('mobile-hub-push', 'Push')
    .addTag('mobile-hub-admin', 'Administração / telemetria staff')
    .addTag('mobile-hub-v2', 'Versão futura')
    .build();

  const mobileDocument = SwaggerModule.createDocument(app, mobileSwagger, {
    include: [MobileHubModule],
  });
  SwaggerModule.setup('docs/mobile', app, mobileDocument);

  const cockpitSwagger = new DocumentBuilder()
    .setTitle('RL Transportes — Cockpit NOC/TOC')
    .setDescription(
      '**Fase 22** — Torre de controle digital: mapa, timeline, alertas, KPIs, multi-terminal, automação, telemetria mobile, financeiro, RH e executivo. **Somente leitura**. ' +
        'RBAC: `ADMIN`/`GERENTE` total; `COCKPIT_SUPERVISOR_EMAILS` estende operadores ao cockpit completo; sem isso, `OPERADOR_*` só `/cockpit/rh/*` e `/cockpit/indicadores/turno`. `CLIENTE` → 403.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT corporativo (`/auth/login`).',
      },
      'access-token',
    )
    .addTag('cockpit-mapa', 'Mapa: pátio, gate, portaria, veículos')
    .addTag('cockpit-timeline', 'Fluxo e eventos')
    .addTag('cockpit-alertas', 'Alert center')
    .addTag('cockpit-indicadores', 'KPIs / turno')
    .addTag('cockpit-tenant', 'Multi-terminal')
    .addTag('cockpit-automacao', 'Workflows / jobs')
    .addTag('cockpit-telemetria', 'Telemetria mobile')
    .addTag('cockpit-financeiro', 'Fiscal / financeiro')
    .addTag('cockpit-rh', 'RH operacional')
    .addTag('cockpit-executivo', 'Executivo 360°')
    .build();

  const cockpitDocument = SwaggerModule.createDocument(app, cockpitSwagger, {
    include: [CockpitOperacoesModule],
  });
  SwaggerModule.setup('docs/cockpit', app, cockpitDocument);

  const port = parseInt(process.env.API_PORT || '3000', 10);
  const host = process.env.API_HOST || '0.0.0.0';

  await app.listen(port, host);

  logger.log(`✓ Server iniciado em http://localhost:${port}`);
  logger.log(`✓ Documentação interna: http://localhost:${port}/docs/internal (e /docs)`);
  logger.log(`✓ Documentação pública: http://localhost:${port}/docs/public`);
  logger.log(`✓ Documentação mobile hub: http://localhost:${port}/docs/mobile`);
  logger.log(`✓ Documentação cockpit NOC/TOC: http://localhost:${port}/docs/cockpit`);
  logger.log(`✓ Ambiente: ${process.env.NODE_ENV || 'development'}`);
  if (process.env.NODE_ENV === 'development') {
    logger.log(`✓ Banco: ${process.env.DATABASE_URL?.split('@')[1] || 'unknown'}`);
  } else {
    logger.log('✓ Banco: configurado (host omitido do log em produção)');
  }
}

bootstrap().catch((err) => {
  console.error('❌ Erro ao iniciar servidor:', err);
  process.exit(1);
});