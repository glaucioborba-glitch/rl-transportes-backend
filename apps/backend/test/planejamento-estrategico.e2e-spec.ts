import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';

describe('Planejamento estratégico (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  const suffix = `${Date.now()}`;
  const emailGerente = `e2e-pl-${suffix}@local.test`;
  const emailGate = `e2e-pl-op-${suffix}@local.test`;
  const emailCliente = `e2e-pl-cl-${suffix}@local.test`;
  const password = 'E2E@PlanoPhase61!';
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

  it('GET /planejamento/demanda-anual GERENTE 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/planejamento/demanda-anual')
      .set('Authorization', `Bearer ${tokenGerente}`)
      .expect(200);

    expect(res.body.volumePrevisto.length).toBe(12);
    expect(res.body).toHaveProperty('confianca');
  });

  it('GET /planejamento/forecast-financeiro GERENTE 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/planejamento/forecast-financeiro')
      .query({ crescimentoEsperadoPctAnual: 4 })
      .set('Authorization', `Bearer ${tokenGerente}`)
      .expect(200);

    expect(res.body.curva12Meses.length).toBe(12);
    expect(res.body).toHaveProperty('otimista');
  });

  it('GET /planejamento/opex GERENTE 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/planejamento/opex')
      .set('Authorization', `Bearer ${tokenGerente}`)
      .expect(200);

    expect(res.body.custoMensalPrevisto.length).toBe(12);
  });

  it('GET /planejamento/capex GERENTE 200', async () => {
    await request(app.getHttpServer())
      .get('/planejamento/capex')
      .query({ expansaoSlotsPlanejados: 50 })
      .set('Authorization', `Bearer ${tokenGerente}`)
      .expect(200);
  });

  it('GET /planejamento/equilibrio GERENTE 200', async () => {
    await request(app.getHttpServer())
      .get('/planejamento/equilibrio')
      .set('Authorization', `Bearer ${tokenGerente}`)
      .expect(200);
  });

  it('GET /planejamento/cenario-estrategico GERENTE 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/planejamento/cenario-estrategico')
      .query({ aumentoDemandaPct: 8 })
      .set('Authorization', `Bearer ${tokenGerente}`)
      .expect(200);

    expect(res.body).toHaveProperty('recomendacaoExecutiva');
  });

  it('GET /planejamento/demanda-anual OPERADOR 403', async () => {
    await request(app.getHttpServer())
      .get('/planejamento/demanda-anual')
      .set('Authorization', `Bearer ${tokenGate}`)
      .expect(403);
  });

  it('GET /planejamento/demanda-anual CLIENTE 403', async () => {
    await request(app.getHttpServer())
      .get('/planejamento/demanda-anual')
      .set('Authorization', `Bearer ${tokenCliente}`)
      .expect(403);
  });

  it('GET /planejamento sem token 401', async () => {
    await request(app.getHttpServer()).get('/planejamento/demanda-anual').expect(401);
  });
});
