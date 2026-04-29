import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';

describe('Financeiro conciliação (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  const suffix = `${Date.now()}`;
  const emailGer = `e2e-fin-${suffix}@local.test`;
  const emailOp = `e2e-fin-op-${suffix}@local.test`;
  const password = 'E2E@FinConc9!';
  let tokenGer: string;
  let tokenOp: string;

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

    const [g, o] = await Promise.all([
      prisma.user.create({ data: { email: emailGer, password: hash, role: Role.GERENTE } }),
      prisma.user.create({ data: { email: emailOp, password: hash, role: Role.OPERADOR_GATE } }),
    ]);

    tokenGer = auth.issueTokens(g).accessToken;
    tokenOp = auth.issueTokens(o).accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [emailGer, emailOp] } } });
    await app.close();
  });

  it('POST /financeiro/extratos/importar GERENTE 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/financeiro/extratos/importar')
      .set('Authorization', `Bearer ${tokenGer}`)
      .send({
        formato: 'CSV',
        conteudo: 'data,valor,historico\n2026-04-28,100.5,teste linha',
        nomeOrigem: 'e2e.csv',
      })
      .expect(201);

    expect(res.body).toHaveProperty('batchId');
    expect(res.body.linhasImportadas).toBeGreaterThanOrEqual(1);
  });

  it('GET /financeiro/extratos/listar GERENTE 200', async () => {
    await request(app.getHttpServer())
      .get('/financeiro/extratos/listar')
      .set('Authorization', `Bearer ${tokenGer}`)
      .expect(200);
  });

  it('GET /financeiro/conciliacao GERENTE 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/financeiro/conciliacao')
      .set('Authorization', `Bearer ${tokenGer}`)
      .expect(200);

    expect(res.body).toHaveProperty('conciliados');
    expect(res.body).toHaveProperty('pendentes');
  });

  it('GET /financeiro/fluxo-caixa GERENTE 200', async () => {
    await request(app.getHttpServer())
      .get('/financeiro/fluxo-caixa')
      .query({ horizonte: 30 })
      .set('Authorization', `Bearer ${tokenGer}`)
      .expect(200);
  });

  it('GET /financeiro/previsibilidade GERENTE 200', async () => {
    await request(app.getHttpServer())
      .get('/financeiro/previsibilidade')
      .set('Authorization', `Bearer ${tokenGer}`)
      .expect(200);
  });

  it('GET /financeiro/dashboard GERENTE 200', async () => {
    await request(app.getHttpServer())
      .get('/financeiro/dashboard')
      .set('Authorization', `Bearer ${tokenGer}`)
      .expect(200);
  });

  it('GET /financeiro/dashboard OPERADOR 403', async () => {
    await request(app.getHttpServer())
      .get('/financeiro/dashboard')
      .set('Authorization', `Bearer ${tokenOp}`)
      .expect(403);
  });

  it('POST /financeiro/extratos/importar sem token 401', async () => {
    await request(app.getHttpServer())
      .post('/financeiro/extratos/importar')
      .send({ formato: 'CSV', conteudo: 'data,valor,historico\n2026-04-28,1,x' })
      .expect(401);
  });
});
