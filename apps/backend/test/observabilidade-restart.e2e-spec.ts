/**
 * E2E #5 — telemetria Redis persiste após restart (NODE_ENV=production).
 * Deve rodar com Redis disponível (CI services).
 */
process.env.NODE_ENV = 'production';
process.env.REDIS_OPTIONAL = '0';

import { cpfCnpjForTestUser } from './helpers/e2e-user.factory';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';
import { RedisService } from '../src/redis/redis.service';
import { OBS_TELEMETRY_COUNTERS } from '../src/observabilidade/observabilidade.constants';

describe('Observabilidade restart Redis (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  let redis: RedisService;
  let tokenAdm: string;
  const emailAdm = `e2e-obs-restart-${Date.now()}@local.test`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    auth = app.get(AuthService);
    redis = app.get(RedisService);

    const hash = await bcrypt.hash('E2E@ObsRestart1!', 10);
    const adm = await prisma.user.create({
      data: {
        cpfCnpj: cpfCnpjForTestUser(emailAdm),
        email: emailAdm,
        password: hash,
        role: Role.ADMIN,
      },
    });
    tokenAdm = auth.issueTokens(adm).accessToken;

    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .get('/health')
        .set('Authorization', `Bearer ${tokenAdm}`)
        .expect(200);
    }
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: emailAdm } });
    await app?.close();
  });

  it('contadores Redis sobrevivem restart do processo', async () => {
    const before = await redis.hgetall(OBS_TELEMETRY_COUNTERS);
    const totalBefore = Number(before.totalReq ?? 0);
    expect(totalBefore).toBeGreaterThan(0);

    await app.close();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
    redis = app.get(RedisService);
    prisma = app.get(PrismaService);
    auth = app.get(AuthService);

    const adm = await prisma.user.findFirst({ where: { email: emailAdm } });
    tokenAdm = auth.issueTokens(adm!).accessToken;

    const dash = await request(app.getHttpServer())
      .get('/observabilidade/dashboard')
      .set('Authorization', `Bearer ${tokenAdm}`)
      .expect(200);

    expect(dash.body.backend).toBe('redis');
    expect(dash.body.totaisRequisicoes.totalReq).toBeGreaterThanOrEqual(totalBefore);
  });
});
