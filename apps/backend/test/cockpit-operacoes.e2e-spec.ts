import { cpfCnpjForTestUser, userWhereForTestEmail } from './helpers/e2e-user.factory';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';

describe('Cockpit operacoes (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  const suffix = `${Date.now()}`;
  const adminEmail = `e2e-cockpit-adm-${suffix}@local.test`;
  const opEmail = `e2e-cockpit-op-${suffix}@local.test`;
  const cliEmail = `e2e-cockpit-cli-${suffix}@local.test`;
  const password = 'CockpitE2E!09';

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
    await prisma.user.createMany({
      data: [
        { cpfCnpj: cpfCnpjForTestUser(adminEmail), email: adminEmail, password: hash, role: Role.ADMIN, clienteId: null },
        { cpfCnpj: cpfCnpjForTestUser(opEmail), email: opEmail, password: hash, role: Role.OPERADOR_GATE, clienteId: null },
        { cpfCnpj: cpfCnpjForTestUser(cliEmail), email: cliEmail, password: hash, role: Role.CLIENTE, clienteId: null },
      ],
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { cpfCnpj: { in: [cpfCnpjForTestUser(adminEmail), cpfCnpjForTestUser(opEmail), cpfCnpjForTestUser(cliEmail)] } },
    });
    await app.close();
  });

  it('GET /cockpit/mapa/patio — ADMIN', async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: userWhereForTestEmail(adminEmail) });
    const t = auth.issueTokens(admin);
    const res = await request(app.getHttpServer())
      .get('/cockpit/mapa/patio')
      .set('Authorization', `Bearer ${t.accessToken}`)
      .expect(200);
    expect(res.body).toHaveProperty('posicoes');
  });

  it('GET /cockpit/alertas — agregação', async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: userWhereForTestEmail(adminEmail) });
    const t = auth.issueTokens(admin);
    const res = await request(app.getHttpServer())
      .get('/cockpit/alertas')
      .set('Authorization', `Bearer ${t.accessToken}`)
      .expect(200);
    expect(res.body).toHaveProperty('itens');
  });

  it('GET /cockpit/tenant/list — multi-terminal', async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: userWhereForTestEmail(adminEmail) });
    const t = auth.issueTokens(admin);
    await request(app.getHttpServer())
      .get('/cockpit/tenant/list')
      .set('Authorization', `Bearer ${t.accessToken}`)
      .expect(200)
      .expect((r) => {
        expect(r.body.terminais).toBeDefined();
      });
  });

  it('GET /cockpit/telemetria/mobile', async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: userWhereForTestEmail(adminEmail) });
    const t = auth.issueTokens(admin);
    await request(app.getHttpServer())
      .get('/cockpit/telemetria/mobile')
      .set('Authorization', `Bearer ${t.accessToken}`)
      .expect(200);
  });

  it('CLIENTE — 403 no cockpit', async () => {
    const cli = await prisma.user.findUniqueOrThrow({ where: userWhereForTestEmail(cliEmail) });
    const t = auth.issueTokens(cli);
    await request(app.getHttpServer())
      .get('/cockpit/mapa/patio')
      .set('Authorization', `Bearer ${t.accessToken}`)
      .expect(403);
  });

  it('OPERADOR — 403 fora do módulo turno', async () => {
    const op = await prisma.user.findUniqueOrThrow({ where: userWhereForTestEmail(opEmail) });
    const t = auth.issueTokens(op);
    await request(app.getHttpServer())
      .get('/cockpit/mapa/patio')
      .set('Authorization', `Bearer ${t.accessToken}`)
      .expect(403);
  });

  it('OPERADOR — 200 indicadores/turno', async () => {
    const op = await prisma.user.findUniqueOrThrow({ where: userWhereForTestEmail(opEmail) });
    const t = auth.issueTokens(op);
    await request(app.getHttpServer())
      .get('/cockpit/indicadores/turno')
      .set('Authorization', `Bearer ${t.accessToken}`)
      .expect(200);
  });
});
