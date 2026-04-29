import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import * as compression from 'compression';
import type { Request } from 'express';
import rateLimit from 'express-rate-limit';
import { AppModule } from './app.module';

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
        return p === '/health' || p.endsWith('/health');
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
        description: 'JWT Access Token',
      },
      'access-token',
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
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = parseInt(process.env.API_PORT || '3000', 10);
  const host = process.env.API_HOST || '0.0.0.0';

  await app.listen(port, host);

  logger.log(`✓ Server iniciado em http://localhost:${port}`);
  logger.log(`✓ Documentação disponível em http://localhost:${port}/docs`);
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