import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';

describe('Observabilidade (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;

  const suffix = `${Date.now()}`;
  const pwd = 'E2E@Obs7!';
  const emailAdm = `e2e-obs-adm-${suffix}@local.test`;
  const emailGer = `e2e-obs-ger-${suffix}@local.test`;
  const emailOp = `e2e-obs-op-${suffix}@local.test`;
  let tokenAdm: string;
  let tokenGer: string;

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
    const hash = await bcrypt.hash(pwd, 10);

    const adm = await prisma.user.create({
      data: { email: emailAdm, password: hash, role: Role.ADMIN },
    });
    const ger = await prisma.user.create({
      data: { email: emailGer, password: hash, role: Role.GERENTE },
    });
    await prisma.user.create({
      data: { email: emailOp, password: hash, role: Role.OPERADOR_GATE },
    });

    tokenAdm = auth.issueTokens(adm).accessToken;
    tokenGer = auth.issueTokens(ger).accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [emailAdm, emailGer, emailOp] } },
    });
    await app.close();
  });

  it('GET /observabilidade/dashboard — ADMIN 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/observabilidade/dashboard')
      .set('Authorization', `Bearer ${tokenAdm}`)
      .expect(200);
    expect(res.body).toHaveProperty('disponibilidadeApiPct');
  });

  it('GET /observabilidade/metricas — GERENTE retorna text/plain', async () => {
    const res = await request(app.getHttpServer())
      .get('/observabilidade/metricas')
      .set('Authorization', `Bearer ${tokenGer}`)
      .expect(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toContain('rl_process_uptime_seconds');
  });

  it('POST /observabilidade/alertas — GERENTE 403', async () => {
    await request(app.getHttpServer())
      .post('/observabilidade/alertas')
      .set('Authorization', `Bearer ${tokenGer}`)
      .send({
        tipo: 'latencia_alta',
        severidade: 'WARN',
        mensagem: 'teste',
      })
      .expect(403);
  });

  it('POST /observabilidade/alertas — ADMIN 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/observabilidade/alertas')
      .set('Authorization', `Bearer ${tokenAdm}`)
      .send({
        tipo: 'latencia_alta',
        severidade: 'WARN',
        mensagem: 'teste e2e',
      })
      .expect(201);
    expect(res.body.id).toBeTruthy();
  });

  it('OPERADOR GET /observabilidade/logs — 403', async () => {
    const op = await prisma.user.findUnique({ where: { email: emailOp } });
    expect(op).toBeTruthy();
    const tOp = auth.issueTokens(op!).accessToken;
    await request(app.getHttpServer())
      .get('/observabilidade/logs')
      .set('Authorization', `Bearer ${tOp}`)
      .expect(403);
  });
});
