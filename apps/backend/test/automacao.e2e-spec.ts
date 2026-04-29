import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';
import { WebhookDeliveryService } from '../src/integracao-mobilidade/services/webhook-delivery.service';
import { IntegracaoEventLogStore } from '../src/integracao-mobilidade/stores/integracao-event-log.store';
import { WebhookSubscriptionStore } from '../src/integracao-mobilidade/stores/webhook-subscription.store';
import { ConfigService } from '@nestjs/config';

describe('AutomacaoProcessos Fase 19 (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  const suffix = `${Date.now()}`;
  const emailAdmin = `auto-ad-${suffix}@local.test`;
  const emailGerente = `auto-ge-${suffix}@local.test`;
  const emailOp = `auto-op-${suffix}@local.test`;
  const emailCliente = `auto-cl-${suffix}@local.test`;
  let idAdmin: string;
  let idGerente: string;
  let idOp: string;
  let idCliente: string;
  const password = 'AutomacaoE2E@T3st!';

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

    const [ua, ug, uo, uc] = await Promise.all([
      prisma.user.create({
        data: { email: emailAdmin, password: hash, role: Role.ADMIN },
      }),
      prisma.user.create({
        data: { email: emailGerente, password: hash, role: Role.GERENTE },
      }),
      prisma.user.create({
        data: { email: emailOp, password: hash, role: Role.OPERADOR_GATE },
      }),
      prisma.user.create({
        data: { email: emailCliente, password: hash, role: Role.CLIENTE },
      }),
    ]);
    idAdmin = ua.id;
    idGerente = ug.id;
    idOp = uo.id;
    idCliente = uc.id;
  });

  afterAll(async () => {
    const ids = [idAdmin, idGerente, idOp, idCliente].filter(Boolean);
    if (prisma && ids.length) {
      await prisma.auditoria.deleteMany({ where: { usuario: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    if (app) await app.close();
  });

  async function token(userId: string) {
    const u = await prisma.user.findUnique({ where: { id: userId } });
    if (!u) throw new Error('user missing');
    return auth.issueTokens(u).accessToken;
  }

  it('CLIENTE recebe 403 em GET /automacao/dashboard', async () => {
    const t = await token(idCliente);
    await request(app.getHttpServer())
      .get('/automacao/dashboard')
      .set('Authorization', `Bearer ${t}`)
      .expect(403);
  });

  it('ADMIN cria workflow, ORQUESTRADOR dispara via WebhookDeliveryService.dispatch', async () => {
    const subs = new WebhookSubscriptionStore();
    const log = new IntegracaoEventLogStore();
    const auditoria = { registrar: jest.fn() } as unknown as import('../src/auditoria/auditoria.service').AuditoriaService;
    const config = { get: () => undefined } as unknown as ConfigService;
    const delivery = new WebhookDeliveryService(subs, log, auditoria, config);

    const admin = await token(idAdmin);
    const criado = await request(app.getHttpServer())
      .post('/automacao/workflows')
      .set('Authorization', `Bearer ${admin}`)
      .send({
        nome: 'E2E Gate',
        eventoDisparo: 'gate.registrado',
        condicoes: [],
        acoes: [{ tipo: 'emitir_alerta', params: { severidade: 'info' } }],
        prioridade: 2,
        ativo: true,
      })
      .expect(201);

    await delivery.dispatch({
      tipo: 'gate.registrado',
      payload: { teste: true },
      correlationId: 'e2e-corr',
    });

    const dash = await request(app.getHttpServer())
      .get('/automacao/dashboard')
      .set('Authorization', `Bearer ${admin}`)
      .expect(200);

    expect(dash.body.execucoesUltimas24h).toBeGreaterThanOrEqual(1);
    expect(criado.body.id).toBeDefined();
  });

  it('OPERADOR 403 em POST /automacao/rpa/jobs/run', async () => {
    const t = await token(idOp);
    await request(app.getHttpServer())
      .post('/automacao/rpa/jobs/run')
      .set('Authorization', `Bearer ${t}`)
      .send({ robotId: 'rpa_faturamento_auto' })
      .expect(403);
  });

  it('GERENTE alterna ativo do workflow', async () => {
    const admin = await token(idAdmin);
    const wf = await request(app.getHttpServer())
      .post('/automacao/workflows')
      .set('Authorization', `Bearer ${admin}`)
      .send({
        nome: 'Toggle Me',
        eventoDisparo: 'boleto.pago',
        condicoes: [],
        acoes: [{ tipo: 'log_destino_modulo', params: { modulo: 'fiscal' } }],
        prioridade: 4,
        ativo: true,
      })
      .expect(201);

    const gerente = await token(idGerente);
    await request(app.getHttpServer())
      .patch(`/automacao/workflows/${wf.body.id}/ativo`)
      .set('Authorization', `Bearer ${gerente}`)
      .send({ ativo: false })
      .expect(200);

    const list = await request(app.getHttpServer())
      .get('/automacao/workflows')
      .set('Authorization', `Bearer ${admin}`)
      .expect(200);

    const found = list.body.find((x: { id: string }) => x.id === wf.body.id);
    expect(found.ativo).toBe(false);
  });
});
