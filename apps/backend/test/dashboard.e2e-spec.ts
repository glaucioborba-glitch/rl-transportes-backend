import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';

describe('Dashboard operacional (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  const suffix = `${Date.now()}`;
  const emailGerente = `dash-ge-${suffix}@local.test`;
  const emailOp = `dash-op-${suffix}@local.test`;
  const emailCliente = `dash-cl-${suffix}@local.test`;
  let userGerenteId: string;
  let userOpId: string;
  let userClienteId: string;
  const password = 'DashE2E@T3st!';

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

    const ug = await prisma.user.create({
      data: {
        email: emailGerente,
        password: hash,
        role: Role.GERENTE,
      },
    });
    const uo = await prisma.user.create({
      data: {
        email: emailOp,
        password: hash,
        role: Role.OPERADOR_GATE,
      },
    });
    const uc = await prisma.user.create({
      data: {
        email: emailCliente,
        password: hash,
        role: Role.CLIENTE,
      },
    });
    userGerenteId = ug.id;
    userOpId = uo.id;
    userClienteId = uc.id;
  });

  afterAll(async () => {
    if (prisma && userGerenteId && userOpId && userClienteId) {
      await prisma.auditoria.deleteMany({
        where: { usuario: { in: [userGerenteId, userOpId, userClienteId] } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [userGerenteId, userOpId, userClienteId] } },
      });
    }
    if (app) await app.close();
  });

  async function token(userId: string) {
    const u = await prisma.user.findUnique({ where: { id: userId } });
    if (!u) throw new Error('user missing');
    return auth.issueTokens(u).accessToken;
  }

  it('CLIENTE recebe 403 em GET /dashboard', async () => {
    const t = await token(userClienteId);
    await request(app.getHttpServer())
      .get('/dashboard')
      .set('Authorization', `Bearer ${t}`)
      .expect(403);
  });

  it('OPERADOR_GATE obtém painel sem bloco clientes', async () => {
    const t = await token(userOpId);
    const res = await request(app.getHttpServer())
      .get('/dashboard')
      .set('Authorization', `Bearer ${t}`)
      .expect(200);
    expect(res.body).toHaveProperty('snapshot');
    expect(res.body).toHaveProperty('sla');
    expect(res.body).toHaveProperty('conflitos');
    expect(res.body).toHaveProperty('filas');
    expect(res.body.clientes).toBeNull();
  });

  it('GERENTE obtém painel com bloco clientes', async () => {
    const t = await token(userGerenteId);
    const res = await request(app.getHttpServer())
      .get('/dashboard')
      .set('Authorization', `Bearer ${t}`)
      .expect(200);
    expect(res.body.clientes).not.toBeNull();
    expect(res.body.clientes).toHaveProperty('unidadesPorCliente');
    expect(res.body.clientes).toHaveProperty('faturamentoPendentePorCliente');
    expect(res.body.sla).toHaveProperty('rankingClientesPorVolume');
  });

  it('sem token retorna 401', async () => {
    await request(app.getHttpServer()).get('/dashboard').expect(401);
  });
});
