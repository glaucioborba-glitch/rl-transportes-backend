import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { Role, TipoCliente } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';

describe('Folha RH (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  const suffix = `${Date.now()}`;
  const emailGer = `e2e-folha-${suffix}@local.test`;
  const emailOp = `e2e-folha-op-${suffix}@local.test`;
  const emailCli = `e2e-folha-cli-${suffix}@local.test`;
  const password = 'E2E@Folha9!';
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
        nome: `E2E Folha Cli ${suffix}`,
        tipo: TipoCliente.PJ,
        cpfCnpj: `${suffix}`.replace(/\D/g, '').padStart(14, '0').slice(-14),
        email: `c-folha-${suffix}@local.test`,
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

  it('fluxo: benefício → colaborador → presença → cálculo', async () => {
    const b = await request(app.getHttpServer())
      .post('/folha/beneficios')
      .set('Authorization', `Bearer ${tokenGer}`)
      .send({
        nomeBeneficio: 'VR',
        valorMensal: 6,
        tipoBeneficio: 'percentual',
      })
      .expect(201);

    const col = await request(app.getHttpServer())
      .post('/folha/colaboradores')
      .set('Authorization', `Bearer ${tokenGer}`)
      .send({
        nome: 'Colaborador E2E',
        cpf: '52998224725',
        cargo: 'Motorista',
        turno: 'NOITE',
        salarioBase: 3500,
        tipoContratacao: 'CLT',
        dataAdmissao: '2025-01-01',
        beneficiosAtivos: ['VR'],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/folha/presencas')
      .set('Authorization', `Bearer ${tokenGer}`)
      .send({
        colaboradorId: col.body.id,
        data: '2026-05-10',
        horasTrabalhadas: 8,
        horasExtras: 2,
        adicionalNoturnoHoras: 1,
        falta: false,
      })
      .expect(201);

    const calc = await request(app.getHttpServer())
      .get('/folha/calculo')
      .query({ mes: '2026-05' })
      .set('Authorization', `Bearer ${tokenGer}`)
      .expect(200);

    expect(calc.body.mes).toBe('2026-05');
    expect(calc.body.porColaborador.length).toBeGreaterThanOrEqual(1);
    expect(b.body.id).toBeDefined();
  });

  it('GET /folha/dashboard GERENTE 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/folha/dashboard')
      .set('Authorization', `Bearer ${tokenGer}`)
      .expect(200);

    expect(res.body).toHaveProperty('headcountAtivo');
    expect(res.body).toHaveProperty('totalFolhaMes');
  });

  it('GET /folha/projecao-anual GERENTE 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/folha/projecao-anual')
      .set('Authorization', `Bearer ${tokenGer}`)
      .expect(200);

    expect(res.body.custoFolha12Meses.length).toBe(12);
  });

  it('GET /folha/custos-turno OPERADOR 403', async () => {
    await request(app.getHttpServer())
      .get('/folha/custos-turno')
      .query({ mes: '2026-05' })
      .set('Authorization', `Bearer ${tokenOp}`)
      .expect(403);
  });

  it('GET /folha/dashboard CLIENTE 403', async () => {
    await request(app.getHttpServer())
      .get('/folha/dashboard')
      .set('Authorization', `Bearer ${tokenCli}`)
      .expect(403);
  });
});
