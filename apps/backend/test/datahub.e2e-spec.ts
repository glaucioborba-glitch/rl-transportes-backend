import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';

describe('Datahub Fase 17 (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  const suffix = `${Date.now()}`;
  const emailAdmin = `dh-ad-${suffix}@local.test`;
  const emailGerente = `dh-ge-${suffix}@local.test`;
  const emailGerenteTi = `dh-ti-${suffix}@local.test`;
  const emailOp = `dh-op-${suffix}@local.test`;
  const emailCliente = `dh-cl-${suffix}@local.test`;
  let idAdmin: string;
  let idGerente: string;
  let idGerenteTi: string;
  let idOp: string;
  let idCliente: string;
  const password = 'DatahubE2E@T3st!';

  beforeAll(async () => {
    process.env.DATAHUB_TI_EMAILS = emailGerenteTi;

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

    const [ua, ug, uti, uo, uc] = await Promise.all([
      prisma.user.create({
        data: { email: emailAdmin, password: hash, role: Role.ADMIN },
      }),
      prisma.user.create({
        data: { email: emailGerente, password: hash, role: Role.GERENTE },
      }),
      prisma.user.create({
        data: { email: emailGerenteTi, password: hash, role: Role.GERENTE },
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
    idGerenteTi = uti.id;
    idOp = uo.id;
    idCliente = uc.id;
  });

  afterAll(async () => {
    const ids = [idAdmin, idGerente, idGerenteTi, idOp, idCliente].filter(Boolean);
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

  it('CLIENTE recebe 403 em GET /datahub/bi/operacional', async () => {
    const t = await token(idCliente);
    await request(app.getHttpServer())
      .get('/datahub/bi/operacional')
      .set('Authorization', `Bearer ${t}`)
      .expect(403);
  });

  it('OPERADOR recebe 403 em GET /datahub/dw/fatos', async () => {
    const t = await token(idOp);
    await request(app.getHttpServer())
      .get('/datahub/dw/fatos')
      .set('Authorization', `Bearer ${t}`)
      .expect(403);
  });

  it('GERENTE de negócio lê BI e DW; 403 em lake/files sem papel TI', async () => {
    const t = await token(idGerente);
    await request(app.getHttpServer())
      .get('/datahub/dw/fatos')
      .set('Authorization', `Bearer ${t}`)
      .expect(200);
    await request(app.getHttpServer())
      .get('/datahub/bi/financeiro')
      .set('Authorization', `Bearer ${t}`)
      .expect(200);
    await request(app.getHttpServer())
      .get('/datahub/lake/files')
      .set('Authorization', `Bearer ${t}`)
      .expect(403);
  });

  it('GERENTE TI lista lake e executa pipeline ETL completo', async () => {
    const t = await token(idGerenteTi);
    await request(app.getHttpServer())
      .get('/datahub/lake/files')
      .set('Authorization', `Bearer ${t}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/datahub/etl/extrair')
      .set('Authorization', `Bearer ${t}`)
      .expect(201);

    await request(app.getHttpServer())
      .post('/datahub/etl/transformar')
      .set('Authorization', `Bearer ${t}`)
      .expect(201);

    const load = await request(app.getHttpServer())
      .post('/datahub/etl/carregar')
      .set('Authorization', `Bearer ${t}`)
      .expect(201);
    expect(load.body).toHaveProperty('linhas');
    expect(load.body.linhas).toBeGreaterThanOrEqual(0);
  });

  it('GERENTE de negócio não executa POST /datahub/etl/extrair', async () => {
    const t = await token(idGerente);
    await request(app.getHttpServer())
      .post('/datahub/etl/extrair')
      .set('Authorization', `Bearer ${t}`)
      .expect(403);
  });

  it('ADMIN executa lake ingest, quality e export', async () => {
    const t = await token(idAdmin);
    await request(app.getHttpServer())
      .post('/datahub/lake/ingest')
      .set('Authorization', `Bearer ${t}`)
      .send({
        origem: 'operacional',
        payload: { e2e: true, t: suffix },
      })
      .expect(201);

    const q = await request(app.getHttpServer())
      .get('/datahub/quality')
      .set('Authorization', `Bearer ${t}`)
      .expect(200);
    expect(q.body).toHaveProperty('chavesOrfas');

    await request(app.getHttpServer())
      .get('/datahub/export/fatos?formato=json&limit=5')
      .set('Authorization', `Bearer ${t}`)
      .expect(200);
  });
});
