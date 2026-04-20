import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import * as compression from 'compression';
import rateLimit from 'express-rate-limit';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  const logger = new Logger('Bootstrap');

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        message:
          'Muitas requisições de seu IP, tente novamente após 15 minutos.',
      },
    }),
  );

  // CORS configuração segura
  app.enableCors({
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
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
    .addTag('clientes', 'Gerenciamento de Clientes')
    .addTag('solicitacoes', 'Gerenciamento de Solicitações')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = parseInt(process.env.API_PORT || '3000', 10);
  const host = process.env.API_HOST || '0.0.0.0';

  await app.listen(port, host);

  logger.log(`✓ Server iniciado em http://localhost:${port}`);
  logger.log(`✓ Documentação disponível em http://localhost:${port}/docs`);
  logger.log(`✓ Ambiente: ${process.env.NODE_ENV || 'development'}`);
  logger.log(`✓ Banco: ${process.env.DATABASE_URL?.split('@')[1] || 'unknown'}`);
}

bootstrap().catch((err) => {
  console.error('❌ Erro ao iniciar servidor:', err);
  process.exit(1);
});