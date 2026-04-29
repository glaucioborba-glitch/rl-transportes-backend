import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';

describe('Fiscal governança (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  const suffix = `${Date.now()}`;
  const emailGer = `e2e-fg-${suffix}@local.test`;
  const emailOp = `e2e-fg-op-${suffix}@local.test`;
  const emailCl = `e2e-fg-cl-${suffix}@local.test`;
  const password = 'E2E@FiscalGovT3st!';
  let tokenGer: string;
  let tokenOp: string;
  let tokenCl: string;

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

    const [g, o, c] = await Promise.all([
      prisma.user.create({ data: { email: emailGer, password: hash, role: Role.GERENTE } }),
      prisma.user.create({ data: { email: emailOp, password: hash, role: Role.OPERADOR_GATE } }),
      prisma.user.create({ data: { email: emailCl, password: hash, role: Role.CLIENTE } }),
    ]);

    tokenGer = auth.issueTokens(g).accessToken;
    tokenOp = auth.issueTokens(o).accessToken;
    tokenCl = auth.issueTokens(c).accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [emailGer, emailOp, emailCl] } },
    });
    await app.close();
  });

  it('GET /fiscal/conciliacao GERENTE 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/fiscal/conciliacao')
      .query({ dias: 30 })
      .set('Authorization', `Bearer ${tokenGer}`)
      .expect(200);

    expect(res.body).toHaveProperty('divergencias');
    expect(Array.isArray(res.body.divergencias)).toBe(true);
  });

  it('GET /fiscal/dashboard GERENTE 200', async () => {
    await request(app.getHttpServer())
      .get('/fiscal/dashboard')
      .set('Authorization', `Bearer ${tokenGer}`)
      .expect(200);
  });

  it('GET /fiscal/saneamento-sugerido GERENTE 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/fiscal/saneamento-sugerido')
      .set('Authorization', `Bearer ${tokenGer}`)
      .expect(200);

    expect(res.body).toHaveProperty('sugestoes');
  });

  it('GET /fiscal/nfse-monitor GERENTE 200', async () => {
    await request(app.getHttpServer())
      .get('/fiscal/nfse-monitor')
      .set('Authorization', `Bearer ${tokenGer}`)
      .expect(200);
  });

  it('GET /fiscal/auditoria-inteligente GERENTE 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/fiscal/auditoria-inteligente')
      .set('Authorization', `Bearer ${tokenGer}`)
      .expect(200);

    expect(res.body).toHaveProperty('eventosCriticos');
  });

  it('GET /fiscal/dashboard OPERADOR 403', async () => {
    await request(app.getHttpServer())
      .get('/fiscal/dashboard')
      .set('Authorization', `Bearer ${tokenOp}`)
      .expect(403);
  });

  it('GET /fiscal/conciliacao CLIENTE 403', async () => {
    await request(app.getHttpServer())
      .get('/fiscal/conciliacao')
      .set('Authorization', `Bearer ${tokenCl}`)
      .expect(403);
  });

  it('GET /fiscal/dashboard sem token 401', async () => {
    await request(app.getHttpServer()).get('/fiscal/dashboard').expect(401);
  });
});
