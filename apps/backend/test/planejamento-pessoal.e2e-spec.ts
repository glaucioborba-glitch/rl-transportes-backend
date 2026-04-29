import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';

describe('Planejamento pessoal (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  const suffix = `${Date.now()}`;
  const emailGerente = `e2e-pp-${suffix}@local.test`;
  const emailAdmin = `e2e-pp-ad-${suffix}@local.test`;
  const emailGate = `e2e-pp-op-${suffix}@local.test`;
  const emailCliente = `e2e-pp-cl-${suffix}@local.test`;
  const password = 'E2E@PlanoPessoalT3st!';
  let tokenGerente: string;
  let tokenAdmin: string;
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

    const [g, a, gt, c] = await Promise.all([
      prisma.user.create({
        data: { email: emailGerente, password: hash, role: Role.GERENTE },
      }),
      prisma.user.create({
        data: { email: emailAdmin, password: hash, role: Role.ADMIN },
      }),
      prisma.user.create({
        data: { email: emailGate, password: hash, role: Role.OPERADOR_GATE },
      }),
      prisma.user.create({
        data: { email: emailCliente, password: hash, role: Role.CLIENTE },
      }),
    ]);

    tokenGerente = auth.issueTokens(g).accessToken;
    tokenAdmin = auth.issueTokens(a).accessToken;
    tokenGate = auth.issueTokens(gt).accessToken;
    tokenCliente = auth.issueTokens(c).accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [emailGerente, emailAdmin, emailGate, emailCliente] } },
    });
    await app.close();
  });

  it('GET /planejamento/headcount-otimo GERENTE 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/planejamento/headcount-otimo')
      .query({ turno: 'MANHA', demandaPrevista: 200, produtividadeHistorica: 20 })
      .set('Authorization', `Bearer ${tokenGerente}`)
      .expect(200);

    expect(res.body).toHaveProperty('headcountRecomendado');
    expect(res.body).toHaveProperty('riscoOperacionalPct');
  });

  it('GET /planejamento/orcamento-anual ADMIN 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/planejamento/orcamento-anual')
      .query({ coeficienteEncargos: 1.78 })
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);

    expect(res.body.custoMensal.length).toBe(12);
    expect(res.body).toHaveProperty('custoAnualPrevisto');
    expect(res.body.deltaMesAMesPct[0]).toBeNull();
  });

  it('GET /planejamento/cenario-pessoal GERENTE 200', async () => {
    await request(app.getHttpServer())
      .get('/planejamento/cenario-pessoal')
      .query({ contratar: 1, volumeEstimadoNovoCliente: 300 })
      .set('Authorization', `Bearer ${tokenGerente}`)
      .expect(200);
  });

  it('GET /planejamento/turnos GERENTE 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/planejamento/turnos')
      .set('Authorization', `Bearer ${tokenGerente}`)
      .expect(200);

    expect(res.body.turnos.length).toBe(3);
  });

  it('GET /planejamento/contratacao GERENTE 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/planejamento/contratacao')
      .set('Authorization', `Bearer ${tokenGerente}`)
      .expect(200);

    expect(res.body.demandaMensalReferencia.length).toBe(12);
    expect(res.body).toHaveProperty('roiContratacaoProxy');
  });

  it('GET /planejamento/headcount-otimo OPERADOR_GATE 403', async () => {
    await request(app.getHttpServer())
      .get('/planejamento/headcount-otimo')
      .query({ turno: 'TARDE', demandaPrevista: 50 })
      .set('Authorization', `Bearer ${tokenGate}`)
      .expect(403);
  });

  it('GET /planejamento/orcamento-anual CLIENTE 403', async () => {
    await request(app.getHttpServer())
      .get('/planejamento/orcamento-anual')
      .set('Authorization', `Bearer ${tokenCliente}`)
      .expect(403);
  });

  it('GET /planejamento/turnos sem token 401', async () => {
    await request(app.getHttpServer()).get('/planejamento/turnos').expect(401);
  });
});
