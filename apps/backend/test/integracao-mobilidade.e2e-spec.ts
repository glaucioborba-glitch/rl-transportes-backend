import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { Role, TipoCliente } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';

describe('Integracao mobilidade (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;

  const suffix = `${Date.now()}`;
  const apiKey = `e2e-int-${suffix}-key`;
  const password = 'E2E@Integ9!';
  let clienteId: string;
  let tokenAdmin: string;
  let tokenOp: string;
  let tokenCliente: string;
  const emailAdmin = `e2e-int-adm-${suffix}@local.test`;
  const emailOp = `e2e-int-op-${suffix}@local.test`;
  const emailCliente = `e2e-int-cli-u-${suffix}@local.test`;

  beforeAll(async () => {
    process.env.INTEGRACAO_INTERNO_SECRET = 'interno-secreto-teste-16';

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

    const cliente = await prisma.cliente.create({
      data: {
        nome: `E2E Int ${suffix}`,
        tipo: TipoCliente.PJ,
        cpfCnpj: `${suffix}`.replace(/\D/g, '').padStart(14, '0').slice(-14),
        email: `e2e-int-cli-${suffix}@local.test`,
        telefone: '',
        endereco: '',
      },
    });
    clienteId = cliente.id;
    process.env.INTEGRACAO_API_KEYS = `${apiKey}|${clienteId}`;

    const admin = await prisma.user.create({
      data: { email: emailAdmin, password: hash, role: Role.ADMIN },
    });
    const op = await prisma.user.create({
      data: { email: emailOp, password: hash, role: Role.OPERADOR_GATE },
    });
    const cli = await prisma.user.create({
      data: {
        email: emailCliente,
        password: hash,
        role: Role.CLIENTE,
        clienteId,
      },
    });

    tokenAdmin = auth.issueTokens(admin).accessToken;
    tokenOp = auth.issueTokens(op).accessToken;
    tokenCliente = auth.issueTokens(cli).accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [emailAdmin, emailOp, emailCliente] } },
    });
    await prisma.cliente.deleteMany({ where: { id: clienteId } });
    await app.close();
  });

  it('GET /api/v1/operacional/resumo — ADMIN envelope v1', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/operacional/resumo')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.meta.apiVersion).toBe('v1');
    expect(res.body.data).toBeDefined();
  });

  it('POST /mobile/portaria — OPERADOR_GATE 202', async () => {
    await request(app.getHttpServer())
      .post('/mobile/portaria')
      .set('Authorization', `Bearer ${tokenOp}`)
      .send({ protocolo: 'X', observacao: 'e2e' })
      .expect(202);
  });

  it('GET /cliente-api/solicitacoes — API Key', async () => {
    const res = await request(app.getHttpServer())
      .get('/cliente-api/solicitacoes')
      .set('X-Api-Key', apiKey)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /cliente-api/solicitacoes — JWT CLIENTE', async () => {
    await request(app.getHttpServer())
      .get('/cliente-api/solicitacoes')
      .set('Authorization', `Bearer ${tokenCliente}`)
      .expect(200);
  });

  it('POST /integracao/eventos — interno', async () => {
    const res = await request(app.getHttpServer())
      .post('/integracao/eventos')
      .set('X-Integracao-Interno', process.env.INTEGRACAO_INTERNO_SECRET!)
      .send({
        tipo: 'gate.registrado',
        payload: { e2e: true },
      })
      .expect(202);
    expect(res.body.aceito).toBe(true);
  });

  it('POST /integracao/pagamentos/webhook — aceito', async () => {
    const res = await request(app.getHttpServer())
      .post('/integracao/pagamentos/webhook')
      .send({
        referencia: `REF-${suffix}`,
        valor: 10.5,
        status: 'confirmado',
        meio: 'PIX',
      })
      .expect(202);
    expect(res.body.aceito).toBe(true);
  });
});
