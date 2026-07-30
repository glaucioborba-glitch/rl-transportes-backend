import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';
import { MobileHubOpsStore } from '../src/mobile-hub/stores/mobile-hub-ops.store';
import { MobileTelemetryCleanupService } from '../src/mobile-hub/stores/mobile-telemetry-cleanup.service';
import { MobileTelemetryStore } from '../src/mobile-hub/stores/mobile-telemetry.store';
import { cpfCnpjForTestUser } from './helpers/e2e-user.factory';

describe('Mobile Hub Persistence (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  let mobileToken: string;
  let adminToken: string;
  const suffix = `${Date.now()}`;
  const opEmail = `e2e-mtel-op-${suffix}@local.test`;
  const adminEmail = `e2e-mtel-adm-${suffix}@local.test`;
  const password = 'MobileTelE2E!1';
  const deviceId = `dev-tel-${suffix}`;

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
    const hash = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        cpfCnpj: cpfCnpjForTestUser(opEmail),
        email: opEmail,
        password: hash,
        role: Role.OPERADOR_GATE,
      },
    });
    await prisma.user.create({
      data: {
        cpfCnpj: cpfCnpjForTestUser(adminEmail),
        email: adminEmail,
        password: hash,
        role: Role.ADMIN,
      },
    });

    const loginOp = await auth.login('default', cpfCnpjForTestUser(opEmail), password);
    const mobileLogin = await request(app.getHttpServer())
      .post('/mobile/v1/auth/login')
      .send({
        documento: cpfCnpjForTestUser(opEmail),
        password,
        deviceId,
        mobileRole: 'OPERADOR_MOBILE',
      });
    mobileToken = mobileLogin.body.accessToken;
    adminToken = loginOp.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('telemetria sobrevive restart do backend', async () => {
    await request(app.getHttpServer())
      .post('/mobile/v1/telemetria')
      .set('Authorization', `Bearer ${mobileToken}`)
      .send({
        localizacao: { lat: -23.55, lng: -46.63 },
        latenciaMsMedia: 120,
        errosRecorrentes: ['sync_timeout'],
        usoOffline: true,
      })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    const countBefore = await prisma.mobileTelemetry.count();
    expect(countBefore).toBeGreaterThanOrEqual(1);

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
    prisma = app.get(PrismaService);
    auth = app.get(AuthService);

    const adminLogin = await auth.login('default', cpfCnpjForTestUser(adminEmail), password);
    const res = await request(app.getHttpServer())
      .get('/mobile/v1/admin/telemetria')
      .set('Authorization', `Bearer ${adminLogin.accessToken}`)
      .expect(200);

    expect(res.body.batches).toBeGreaterThanOrEqual(1);
  });

  it('hub-ops sobrevive restart do backend', async () => {
    const opsStore = app.get(MobileHubOpsStore);
    await opsStore.add({
      userId: 'e2e-user-sub',
      canal: 'gate_in',
      protocolo: `PROT-${suffix}`,
      extras: { test: true },
    });

    expect(await prisma.mobileHubOp.count()).toBeGreaterThanOrEqual(1);

    await app.close();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    auth = app.get(AuthService);

    const adminLogin = await auth.login('default', cpfCnpjForTestUser(adminEmail), password);
    const res = await request(app.getHttpServer())
      .get('/mobile/v1/admin/ops')
      .set('Authorization', `Bearer ${adminLogin.accessToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((r: { resumo?: { protocolo?: string } }) => r.resumo?.protocolo === `PROT-${suffix}`)).toBe(true);
  });

  it('cleanup TTL remove telemetria >7 dias', async () => {
    const oldId = `tel-old-${suffix}`;
    await prisma.mobileTelemetry.create({
      data: {
        id: oldId,
        userId: 'cleanup-user',
        canal: 'OPERADOR_MOBILE',
        errors: [],
        createdAt: new Date(Date.now() - 8 * 24 * 3600 * 1000),
      },
    });

    const store = app.get(MobileTelemetryStore);
    const deleted = await store.cleanupOlderThan(7);
    expect(deleted).toBeGreaterThanOrEqual(1);

    const row = await prisma.mobileTelemetry.findUnique({ where: { id: oldId } });
    expect(row).toBeNull();
  });

  it('cleanup CRON usa runSafe sem crash', async () => {
    const cron = app.get(MobileTelemetryCleanupService);
    await expect(cron.runDailyCleanup()).resolves.not.toThrow();
  });
});
