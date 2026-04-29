import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';

describe('Simulador terminal (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  const suffix = `${Date.now()}`;
  const emailGerente = `e2e-sim-gr-${suffix}@local.test`;
  const emailGate = `e2e-sim-gt-${suffix}@local.test`;
  const emailCliente = `e2e-sim-cl-${suffix}@local.test`;
  const password = 'E2E@SimTermPhase51!';
  let tokenGerente: string;
  let tokenGate: string;
  let tokenCliente: string;

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

    const g = await prisma.user.create({
      data: { email: emailGerente, password: hash, role: Role.GERENTE },
    });
    const gt = await prisma.user.create({
      data: { email: emailGate, password: hash, role: Role.OPERADOR_GATE },
    });
    const c = await prisma.user.create({
      data: { email: emailCliente, password: hash, role: Role.CLIENTE },
    });

    tokenGerente = auth.issueTokens(g).accessToken;
    tokenGate = auth.issueTokens(gt).accessToken;
    tokenCliente = auth.issueTokens(c).accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [emailGerente, emailGate, emailCliente] } },
    });
    await app.close();
  });

  it('GET /simulador/capacidade GERENTE 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/simulador/capacidade')
      .set('Authorization', `Bearer ${tokenGerente}`)
      .expect(200);

    expect(res.body).toHaveProperty('capacidadePatioSlotsTotal');
    expect(res.body).toHaveProperty('fatorSaturacaoPct');
  });

  it('GET /simulador/projecao-saturacao GERENTE 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/simulador/projecao-saturacao')
      .set('Authorization', `Bearer ${tokenGerente}`)
      .expect(200);

    expect(res.body.projecoes.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /simulador/cenario GERENTE 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/simulador/cenario')
      .query({ aumentoDemandaPercentual: 10 })
      .set('Authorization', `Bearer ${tokenGerente}`)
      .expect(200);

    expect(res.body).toHaveProperty('saturacaoResultantePct');
    expect(Array.isArray(res.body.gargalosProvaveis)).toBe(true);
  });

  it('GET /simulador/expansao GERENTE 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/simulador/expansao')
      .query({ quadrasAdicionais: 1 })
      .set('Authorization', `Bearer ${tokenGerente}`)
      .expect(200);

    expect(res.body).toHaveProperty('roiOperacionalProxy');
  });

  it('GET /simulador/turnos GERENTE 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/simulador/turnos')
      .set('Authorization', `Bearer ${tokenGerente}`)
      .expect(200);

    expect(res.body.porTurno.length).toBe(3);
  });

  it('GET /simulador/capacidade GATE 200', async () => {
    await request(app.getHttpServer())
      .get('/simulador/capacidade')
      .set('Authorization', `Bearer ${tokenGate}`)
      .expect(200);
  });

  it('GET /simulador/projecao-saturacao GATE 403', async () => {
    await request(app.getHttpServer())
      .get('/simulador/projecao-saturacao')
      .set('Authorization', `Bearer ${tokenGate}`)
      .expect(403);
  });

  it('GET /simulador/cenario GATE 200', async () => {
    await request(app.getHttpServer())
      .get('/simulador/cenario')
      .query({ aumentoDemandaPercentual: 5 })
      .set('Authorization', `Bearer ${tokenGate}`)
      .expect(200);
  });

  it('GET /simulador/expansao GATE 403', async () => {
    await request(app.getHttpServer())
      .get('/simulador/expansao')
      .set('Authorization', `Bearer ${tokenGate}`)
      .expect(403);
  });

  it('GET /simulador/capacidade CLIENTE 403', async () => {
    await request(app.getHttpServer())
      .get('/simulador/capacidade')
      .set('Authorization', `Bearer ${tokenCliente}`)
      .expect(403);
  });

  it('GET /simulador sem token 401', async () => {
    await request(app.getHttpServer()).get('/simulador/capacidade').expect(401);
  });
});
