import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { Role, TipoCliente } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';

describe('Tesouraria (e2e)', () => {
  function cnpjUnico() {
    const n = `9${Date.now()}${process.hrtime.bigint() % 1000n}`.replace(/\D/g, '');
    return n.padStart(14, '0').slice(-14);
  }

  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  const suffix = `${Date.now()}`;
  const emailGer = `e2e-teso-${suffix}@local.test`;
  const emailOp = `e2e-teso-op-${suffix}@local.test`;
  const emailCli = `e2e-teso-cli-${suffix}@local.test`;
  const password = 'E2E@Teso9!';
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
        nome: `E2E Teso Cli ${suffix}`,
        tipo: TipoCliente.PJ,
        cpfCnpj: cnpjUnico(),
        email: `c-teso-${suffix}@local.test`,
        telefone: '',
        endereco: '',
      },
    });
    clienteId = cli.id;
    const uCli = await prisma.user.create({
      data: {
        email: emailCli,
        password: hash,
        role: Role.CLIENTE,
        clienteId,
      },
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

  it('POST /tesouraria/despesas GERENTE 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/tesouraria/despesas')
      .set('Authorization', `Bearer ${tokenGer}`)
      .send({
        fornecedor: 'Fornecedor E2E',
        categoria: 'OPEX',
        descricao: 'Aluguel galpão',
        valor: 4200,
        vencimento: '2026-05-10',
        recorrencia: 'nenhuma',
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.statusEfetivo).toBeDefined();
  });

  it('GET /tesouraria/despesas GERENTE 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/tesouraria/despesas')
      .set('Authorization', `Bearer ${tokenGer}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /tesouraria/agenda GERENTE 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/tesouraria/agenda')
      .set('Authorization', `Bearer ${tokenGer}`)
      .expect(200);

    expect(res.body).toHaveProperty('pagamentosPorDia');
    expect(res.body).toHaveProperty('pagamentosPorSemana');
    expect(res.body).toHaveProperty('pagamentosPorMes');
  });

  it('GET /tesouraria/dashboard GERENTE 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/tesouraria/dashboard')
      .set('Authorization', `Bearer ${tokenGer}`)
      .expect(200);

    expect(res.body).toHaveProperty('curvaOpex12Meses');
    expect(res.body).toHaveProperty('riscoSaidasFinanceiras');
  });

  it('GET /tesouraria/impacto-caixa GERENTE 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/tesouraria/impacto-caixa')
      .set('Authorization', `Bearer ${tokenGer}`)
      .expect(200);

    expect(res.body).toHaveProperty('impactoOpex7d');
    expect(res.body).toHaveProperty('impactoOpex15d');
    expect(res.body.impactoOpex30d).toHaveProperty('caixaLiquidoProjetado');
  });

  it('GET /tesouraria/sugestoes GERENTE 200', async () => {
    await request(app.getHttpServer())
      .get('/tesouraria/sugestoes')
      .set('Authorization', `Bearer ${tokenGer}`)
      .expect(200);
  });

  it('GET /tesouraria/dashboard OPERADOR 403', async () => {
    await request(app.getHttpServer())
      .get('/tesouraria/dashboard')
      .set('Authorization', `Bearer ${tokenOp}`)
      .expect(403);
  });

  it('GET /tesouraria/dashboard CLIENTE 403', async () => {
    await request(app.getHttpServer())
      .get('/tesouraria/dashboard')
      .set('Authorization', `Bearer ${tokenCli}`)
      .expect(403);
  });

  it('POST /tesouraria/despesas sem token 401', async () => {
    await request(app.getHttpServer())
      .post('/tesouraria/despesas')
      .send({
        fornecedor: 'X',
        categoria: 'OPEX',
        descricao: 'Y',
        valor: 1,
        vencimento: '2026-05-10',
      })
      .expect(401);
  });
});
