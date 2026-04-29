import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { Role, TipoCliente } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';

describe('GRC Compliance (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  let clienteId: string;

  const suffix = `${Date.now()}`;
  const password = 'E2E@GrcT3st!';
  const emailAdmin = `e2e-grc-admin-${suffix}@local.test`;
  const emailOp = `e2e-grc-op-${suffix}@local.test`;
  const emailCliente = `e2e-grc-cli-${suffix}@local.test`;
  const emailSup = `e2e-grc-sup-${suffix}@local.test`;

  let tokenAdmin: string;
  let tokenOp: string;
  let tokenCliente: string;
  let tokenSup: string;

  beforeAll(async () => {
    process.env.GRC_SUPERVISOR_EMAILS = emailSup;

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

    const admin = await prisma.user.create({
      data: { email: emailAdmin, password: hash, role: Role.ADMIN },
    });
    const operador = await prisma.user.create({
      data: { email: emailOp, password: hash, role: Role.OPERADOR_GATE },
    });
    const sup = await prisma.user.create({
      data: { email: emailSup, password: hash, role: Role.OPERADOR_GATE },
    });

    const cliente = await prisma.cliente.create({
      data: {
        nome: `E2E GRC Cli ${suffix}`,
        tipo: TipoCliente.PJ,
        cpfCnpj: `${suffix}`.replace(/\D/g, '').padStart(14, '0').slice(-14),
        email: `e2e-grc-clidata-${suffix}@local.test`,
        telefone: '',
        endereco: '',
      },
    });
    clienteId = cliente.id;

    const userCliente = await prisma.user.create({
      data: {
        email: emailCliente,
        password: hash,
        role: Role.CLIENTE,
        clienteId,
      },
    });

    tokenAdmin = auth.issueTokens(admin).accessToken;
    tokenOp = auth.issueTokens(operador).accessToken;
    tokenSup = auth.issueTokens(sup).accessToken;
    tokenCliente = auth.issueTokens(userCliente).accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: { in: [emailAdmin, emailOp, emailCliente, emailSup] },
      },
    });
    if (clienteId) {
      await prisma.cliente.deleteMany({ where: { id: clienteId } });
    }
    await app.close();
  });

  const riscoPayload = {
    titulo: `Risco E2E ${suffix}`,
    descricao: 'Descrição do risco de teste.',
    categoria: 'operacional',
    probabilidade: 3,
    impacto: 4,
    status: 'aberto',
    responsavel: 'E2E Owner',
    origem: 'operacao',
  };

  it('GET /grc/riscos — OPERADOR 403; CLIENTE 403', async () => {
    await request(app.getHttpServer())
      .get('/grc/riscos')
      .set('Authorization', `Bearer ${tokenOp}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/grc/riscos')
      .set('Authorization', `Bearer ${tokenCliente}`)
      .expect(403);
  });

  it('POST /grc/riscos — ADMIN cria risco com severidade = prob × impacto', async () => {
    const res = await request(app.getHttpServer())
      .post('/grc/riscos')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(riscoPayload)
      .expect(201);
    expect(res.body.severidade).toBe(riscoPayload.probabilidade * riscoPayload.impacto);
    expect(res.body.id).toBeTruthy();
  });

  it('GET /grc/auditoria-inteligente — ADMIN retorna scoreCompliance e incidentes[]', async () => {
    const res = await request(app.getHttpServer())
      .get('/grc/auditoria-inteligente')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    expect(Array.isArray(res.body.incidentes)).toBe(true);
    expect(typeof res.body.scoreCompliance).toBe('number');
    expect(res.body.scoreCompliance).toBeGreaterThanOrEqual(0);
    expect(res.body.scoreCompliance).toBeLessThanOrEqual(100);
  });

  it('GET /grc/dashboard — ADMIN retorna painel consolidado', async () => {
    const res = await request(app.getHttpServer())
      .get('/grc/dashboard')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    expect(res.body).toHaveProperty('riscosPorSeveridade');
    expect(res.body).toHaveProperty('scoreCompliance');
    expect(res.body).toHaveProperty('mapaRiscoCorporativo');
  });

  it('POST /grc/controles — supervisor na lista NÃO pode (403); ADMIN pode (201)', async () => {
    const list = await request(app.getHttpServer())
      .get('/grc/riscos')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    const riscoId = list.body[0]?.id as string;
    expect(riscoId).toBeTruthy();

    await request(app.getHttpServer())
      .post('/grc/controles')
      .set('Authorization', `Bearer ${tokenSup}`)
      .send({
        nomeControle: 'Controle E2E',
        riscoRelacionadoId: riscoId,
        frequencia: 'mensal',
        responsavel: 'Resp',
        evidencia: 'evidência texto',
        eficacia: 75,
      })
      .expect(403);

    await request(app.getHttpServer())
      .post('/grc/controles')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        nomeControle: 'Controle E2E Admin',
        riscoRelacionadoId: riscoId,
        frequencia: 'mensal',
        responsavel: 'Resp',
        evidencia: 'evidência texto',
        eficacia: 75,
      })
      .expect(201);
  });

  it('supervisor (e-mail allowlist) pode GET /grc/riscos e POST /grc/planos-acao', async () => {
    await request(app.getHttpServer())
      .get('/grc/riscos')
      .set('Authorization', `Bearer ${tokenSup}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/grc/planos-acao')
      .set('Authorization', `Bearer ${tokenSup}`)
      .send({
        what: 'Ação',
        why: 'Motivo',
        where: 'Terminal',
        when: '2026-Q2',
        who: 'Compliance',
        how: 'Matriz',
        howMuch: 0,
        status: 'aberto',
      })
      .expect(201);
  });
});
