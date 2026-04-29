import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';

describe('Plataforma Fase 18 (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  const suffix = `${Date.now()}`;
  const emailAdmin = `pf-ad-${suffix}@local.test`;
  const emailGerente = `pf-ge-${suffix}@local.test`;
  const emailOp = `pf-op-${suffix}@local.test`;
  let idAdmin: string;
  let idGerente: string;
  let idOp: string;
  const password = 'PlataformaE2E@T3st!';
  const publicKey = 'demo-pk';
  const publicSecret = 'demo-sk';

  beforeAll(async () => {
    process.env.PLATAFORMA_API_CLIENTS = `${publicKey}|${publicSecret}|E2E|default|300`;

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
    const [ua, ug, uo] = await Promise.all([
      prisma.user.create({ data: { email: emailAdmin, password: hash, role: Role.ADMIN } }),
      prisma.user.create({ data: { email: emailGerente, password: hash, role: Role.GERENTE } }),
      prisma.user.create({ data: { email: emailOp, password: hash, role: Role.OPERADOR_GATE } }),
    ]);
    idAdmin = ua.id;
    idGerente = ug.id;
    idOp = uo.id;
  });

  afterAll(async () => {
    const ids = [idAdmin, idGerente, idOp].filter(Boolean);
    if (prisma && ids.length) {
      await prisma.auditoria.deleteMany({ where: { usuario: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    if (app) await app.close();
  });

  async function jwt(id: string) {
    const u = await prisma.user.findUnique({ where: { id } });
    if (!u) throw new Error('user');
    return auth.issueTokens(u).accessToken;
  }

  it('GET /public/v1/solicitacoes sem headers → 401', async () => {
    await request(app.getHttpServer()).get('/public/v1/solicitacoes').expect(401);
  });

  it('GET /public/v1/solicitacoes com API pública → 200 envelope', async () => {
    const res = await request(app.getHttpServer())
      .get('/public/v1/solicitacoes?limit=2')
      .set('X-Public-Api-Key', publicKey)
      .set('X-Public-Api-Secret', publicSecret)
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.meta.apiVersion).toBe('v1');
    expect(res.body.data).toHaveProperty('itens');
  });

  it('GET /marketplace/servicos com API pública → 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/marketplace/servicos')
      .set('X-Public-Api-Key', publicKey)
      .set('X-Public-Api-Secret', publicSecret)
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /gateway/status → 200', async () => {
    await request(app.getHttpServer()).get('/gateway/status').expect(200);
  });

  it('GET /api-contracts/v1/webhooks → lista eventos', async () => {
    const res = await request(app.getHttpServer()).get('/api-contracts/v1/webhooks').expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.some((x: { evento: string }) => x.evento === 'nfse.emitida')).toBe(true);
  });

  it('OPERADOR 403 em /plataforma/consumo', async () => {
    const t = await jwt(idOp);
    await request(app.getHttpServer())
      .get('/plataforma/consumo')
      .set('Authorization', `Bearer ${t}`)
      .expect(403);
  });

  it('GERENTE lê /plataforma/estatisticas', async () => {
    const t = await jwt(idGerente);
    await request(app.getHttpServer())
      .get('/plataforma/estatisticas')
      .set('Authorization', `Bearer ${t}`)
      .expect(200);
  });

  it('ADMIN registra assinatura marketplace', async () => {
    const t = await jwt(idAdmin);
    const clients = await request(app.getHttpServer())
      .get('/plataforma/admin/api-clients')
      .set('Authorization', `Bearer ${t}`)
      .expect(200);
    const first = clients.body.data[0];
    if (!first?.id) return;
    await request(app.getHttpServer())
      .post('/marketplace/assinaturas')
      .set('Authorization', `Bearer ${t}`)
      .send({
        apiClientId: first.id,
        servicoIds: ['tracking_operacional', 'sla_service'],
        habilitado: true,
      })
      .expect(201);
  });
});
