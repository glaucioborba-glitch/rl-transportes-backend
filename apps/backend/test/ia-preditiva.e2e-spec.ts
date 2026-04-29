import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { Role, TipoCliente } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';

describe('IA preditiva (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authService: AuthService;
  const suffix = `${Date.now()}`;
  const emailGer = `e2e-ia-g-${suffix}@local.test`;
  const emailCli = `e2e-ia-c-${suffix}@local.test`;
  const emailOp = `e2e-ia-o-${suffix}@local.test`;
  const password = 'E2E@IaPredT3st!';
  let tokenGerente: string;
  let tokenCliente: string;
  let tokenOperador: string;
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
    authService = app.get(AuthService);
    const hash = await bcrypt.hash(password, 10);

    const c = await prisma.cliente.create({
      data: {
        nome: `E2E IA ${suffix}`,
        tipo: TipoCliente.PJ,
        cpfCnpj: `${suffix}`.replace(/\D/g, '').padStart(14, '0').slice(-14),
        email: `e2e-ia-cli-${suffix}@corp.local`,
        telefone: '',
        endereco: '',
      },
    });
    clienteId = c.id;

    await prisma.user.create({
      data: {
        email: emailGer,
        password: hash,
        role: Role.GERENTE,
      },
    });
    await prisma.user.create({
      data: {
        email: emailCli,
        password: hash,
        role: Role.CLIENTE,
        clienteId,
      },
    });
    await prisma.user.create({
      data: {
        email: emailOp,
        password: hash,
        role: Role.OPERADOR_PATIO,
      },
    });

    const uGer = await prisma.user.findUniqueOrThrow({ where: { email: emailGer } });
    const uCli = await prisma.user.findUniqueOrThrow({ where: { email: emailCli } });
    const uOp = await prisma.user.findUniqueOrThrow({ where: { email: emailOp } });
    tokenGerente = authService.issueTokens(uGer).accessToken;
    tokenCliente = authService.issueTokens(uCli).accessToken;
    tokenOperador = authService.issueTokens(uOp).accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [emailGer, emailCli, emailOp] } },
    });
    await prisma.cliente.delete({ where: { id: clienteId } }).catch(() => undefined);
    await app.close();
  });

  it('GET /ia-preditiva/demanda — GERENTE recebe previsões', () => {
    return request(app.getHttpServer())
      .get('/ia-preditiva/demanda')
      .set('Authorization', `Bearer ${tokenGerente}`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('previsoes');
        expect(res.body).toHaveProperty('modelo');
      });
  });

  it('GET /ia-preditiva/demanda — CLIENTE recebe 403', () => {
    return request(app.getHttpServer())
      .get('/ia-preditiva/demanda')
      .set('Authorization', `Bearer ${tokenCliente}`)
      .expect(403);
  });

  it('GET /ia-preditiva/modelos — OPERADOR recebe 403', () => {
    return request(app.getHttpServer())
      .get('/ia-preditiva/modelos')
      .set('Authorization', `Bearer ${tokenOperador}`)
      .expect(403);
  });

  it('POST /ia-preditiva/treinar — GERENTE executa pipeline', () => {
    return request(app.getHttpServer())
      .post('/ia-preditiva/treinar')
      .set('Authorization', `Bearer ${tokenGerente}`)
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
        expect(res.body).toHaveProperty('demanda');
        expect(res.body).toHaveProperty('versao');
      });
  });
});
