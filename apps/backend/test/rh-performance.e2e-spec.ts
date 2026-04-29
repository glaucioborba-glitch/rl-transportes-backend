import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { Role, TipoCliente } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';

describe('RH Performance (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  const suffix = `${Date.now()}`;
  const emailGer = `e2e-rhp-${suffix}@local.test`;
  const emailOp = `e2e-rhp-op-${suffix}@local.test`;
  const emailCli = `e2e-rhp-cli-${suffix}@local.test`;
  const password = 'E2E@RhPerf9!';
  let tokenGer: string;
  let tokenOp: string;
  let tokenCli: string;
  let clienteId: string;

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

    const cli = await prisma.cliente.create({
      data: {
        nome: `E2E RHP Cli ${suffix}`,
        tipo: TipoCliente.PJ,
        cpfCnpj: `${suffix}`.replace(/\D/g, '').padStart(14, '0').slice(-14),
        email: `c-rhp-${suffix}@local.test`,
        telefone: '',
        endereco: '',
      },
    });
    clienteId = cli.id;
    const uCli = await prisma.user.create({
      data: { email: emailCli, password: hash, role: Role.CLIENTE, clienteId },
    });

    tokenGer = auth.issueTokens(g).accessToken;
    tokenOp = auth.issueTokens(o).accessToken;
    tokenCli = auth.issueTokens(uCli).accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [emailGer, emailOp, emailCli] } } });
    await prisma.cliente.deleteMany({ where: { id: clienteId } });
    await app.close();
  });

  it('POST /rh/performance/avaliacoes GERENTE 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/rh/performance/avaliacoes')
      .set('Authorization', `Bearer ${tokenGer}`)
      .send({
        colaboradorId: 'colab-test-1',
        periodo: '2026-05',
        avaliador: 'Gestor RH',
        notaTecnica: 8,
        notaComportamental: 7,
        aderenciaProcedimentos: 9,
        qualidadeExecucao: 8,
        comprometimento: 8,
        turnoReferencia: 'MANHA',
        cargoReferencia: 'Operador',
      })
      .expect(201);

    expect(res.body.scoreFinal).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('id');
  });

  it('POST /rh/performance/okr GERENTE 201', async () => {
    await request(app.getHttpServer())
      .post('/rh/performance/okr')
      .set('Authorization', `Bearer ${tokenGer}`)
      .send({
        objetivo: 'Aumentar produtividade do gate',
        escopo: 'setorial',
        keyResults: ['Reduzir tempo médio de permanência em 10%'],
        progressoAtual: 35,
        periodoInicio: '2026-01-01',
        periodoFim: '2026-06-30',
        responsavel: 'Coordenação',
      })
      .expect(201);
  });

  it('GET /rh/performance/dashboard GERENTE 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/rh/performance/dashboard')
      .set('Authorization', `Bearer ${tokenGer}`)
      .expect(200);

    expect(res.body).toHaveProperty('tendenciaPerformance');
    expect(res.body).toHaveProperty('mapaCompetencias');
  });

  it('GET /rh/performance/kpis GERENTE 200', async () => {
    await request(app.getHttpServer())
      .get('/rh/performance/kpis')
      .set('Authorization', `Bearer ${tokenGer}`)
      .expect(200);
  });

  it('GET /rh/performance/bsc GERENTE 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/rh/performance/bsc')
      .set('Authorization', `Bearer ${tokenGer}`)
      .expect(200);

    expect(res.body.perspectivas.length).toBe(4);
  });

  it('GET /rh/performance/dashboard OPERADOR 403', async () => {
    await request(app.getHttpServer())
      .get('/rh/performance/dashboard')
      .set('Authorization', `Bearer ${tokenOp}`)
      .expect(403);
  });

  it('GET /rh/performance/dashboard CLIENTE 403', async () => {
    await request(app.getHttpServer())
      .get('/rh/performance/dashboard')
      .set('Authorization', `Bearer ${tokenCli}`)
      .expect(403);
  });
});
