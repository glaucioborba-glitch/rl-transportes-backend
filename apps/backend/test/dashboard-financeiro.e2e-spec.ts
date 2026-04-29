import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';

describe('Dashboard financeiro executivo (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  const suffix = `${Date.now()}`;
  const emailGe = `df-ge-${suffix}@local.test`;
  const emailOp = `df-op-${suffix}@local.test`;
  let geId: string;
  let opId: string;
  const password = 'DfE2E@T3st!';

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

    const uGe = await prisma.user.create({
      data: { email: emailGe, password: hash, role: Role.GERENTE },
    });
    const uOp = await prisma.user.create({
      data: { email: emailOp, password: hash, role: Role.OPERADOR_GATE },
    });
    geId = uGe.id;
    opId = uOp.id;
  });

  afterAll(async () => {
    if (prisma && geId && opId) {
      await prisma.user.deleteMany({ where: { id: { in: [geId, opId] } } });
    }
    if (app) await app.close();
  });

  async function token(userId: string) {
    const u = await prisma.user.findUnique({ where: { id: userId } });
    if (!u) throw new Error('user missing');
    return auth.issueTokens(u).accessToken;
  }

  it('OPERADOR_GATE recebe 403 em GET /dashboard-financeiro', async () => {
    const t = await token(opId);
    await request(app.getHttpServer())
      .get('/dashboard-financeiro')
      .set('Authorization', `Bearer ${t}`)
      .expect(403);
  });

  it('GERENTE obtém payload estruturado', async () => {
    const t = await token(geId);
    const res = await request(app.getHttpServer())
      .get('/dashboard-financeiro')
      .set('Authorization', `Bearer ${t}`)
      .expect(200);

    expect(res.body).toHaveProperty('snapshot');
    expect(res.body).toHaveProperty('receita');
    expect(res.body).toHaveProperty('inadimplencia');
    expect(res.body).toHaveProperty('rentabilidade');
    expect(res.body).toHaveProperty('aging');
    expect(res.body).toHaveProperty('series');
    expect(res.body).toHaveProperty('clientes');
    expect(res.body.inadimplencia).toHaveProperty('forecastInadimplenciaPercent');
    expect(res.body.inadimplencia).toHaveProperty('forecastFaturamentoProximoMes');
    expect(typeof res.body.snapshot.faturamentoTotalPeriodo).toBe('number');
  });

  it('sem token retorna 401', async () => {
    await request(app.getHttpServer()).get('/dashboard-financeiro').expect(401);
  });
});
