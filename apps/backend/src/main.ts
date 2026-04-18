import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { existsSync, mkdirSync } from 'node:fs';
import rateLimit from 'express-rate-limit';
import { AppModule } from './app.module';
import { buildWinstonLogger } from './common/logger/winston.config';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';

async function bootstrap() {
  if (!existsSync('logs')) {
    mkdirSync('logs', { recursive: true });
  }

  const app = await NestFactory.create(AppModule, {
    logger: buildWinstonLogger(),
    bufferLogs: true,
  });

  app.use(requestIdMiddleware);
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
      message: { message: 'Muitas requisições deste IP, tente novamente em alguns minutos.' },
    }),
  );

  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('RL Transportes API')
    .setDescription('API Fase 1 — autenticação, clientes e solicitações')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        in: 'header',
      },
      'access-token',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.API_PORT ?? 3000;
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`Application is running on: http://127.0.0.1:${port}`);
}

bootstrap();
