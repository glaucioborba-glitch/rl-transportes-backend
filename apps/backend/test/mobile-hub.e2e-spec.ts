import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { Role, StatusSolicitacao, TipoCliente } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';

function cnpjUnico() {
  const n = `1${Date.now()}${process.hrtime.bigint() % 1000n}`.replace(/\D/g, '');
  return n.padStart(14, '0').slice(-14);
}

describe('Mobile hub (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authService: AuthService;
  const suffix = `${Date.now()}`;
  const protocolo = `MOB-HUB-E2E-${suffix}`;
  const opEmail = `e2e-mop-${suffix}@local.test`;
  const cliEmail = `e2e-mcli-${suffix}@local.test`;
  const motEmail = `e2e-mmot-${suffix}@local.test`;
  const adminEmail = `e2e-madm-${suffix}@local.test`;
  const password = 'M0bileHubE2E!';

  let clienteId: string;
  const deviceId = `dev-e2e-${suffix}`;

  beforeAll(async () => {
    delete process.env.MOBILE_CRITICAL_PIN;
    process.env.MOBILE_MOTORISTA_SEED = `${motEmail}|${password}|${protocolo}`;

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

    const cliente = await prisma.cliente.create({
      data: {
        nome: `E2E Mobile ${suffix}`,
        tipo: TipoCliente.PJ,
        cpfCnpj: cnpjUnico(),
        email: `c-mail-${suffix}@local.test`,
        telefone: '',
        endereco: '',
      },
    });
    clienteId = cliente.id;

    await prisma.solicitacao.create({
      data: {
        protocolo,
        clienteId,
        status: StatusSolicitacao.PENDENTE,
      },
    });

    await prisma.user.create({
      data: {
        email: opEmail,
        password: hash,
        role: Role.OPERADOR_GATE,
        clienteId: null,
      },
    });

    await prisma.user.create({
      data: {
        email: cliEmail,
        password: hash,
        role: Role.CLIENTE,
        clienteId,
      },
    });

    await prisma.user.create({
      data: {
        email: adminEmail,
        password: hash,
        role: Role.ADMIN,
        clienteId: null,
      },
    });
  });

  afterAll(async () => {
    delete process.env.MOBILE_MOTORISTA_SEED;
    const orphanUsers = await prisma.user.findMany({
      where: { email: { in: [opEmail, cliEmail, adminEmail, motEmail] } },
      select: { id: true },
    });
    const orphanIds = orphanUsers.map((u) => u.id);
    if (orphanIds.length) {
      await prisma.auditoria.deleteMany({ where: { usuario: { in: orphanIds } } });
    }
    await prisma.solicitacao.deleteMany({ where: { protocolo } });
    await prisma.user.deleteMany({
      where: { email: { in: [opEmail, cliEmail, adminEmail, motEmail] } },
    });
    await prisma.cliente.deleteMany({ where: { id: clienteId } });
    await app.close();
  });

  it('POST /mobile/v1/auth/login operador retorna tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/mobile/v1/auth/login')
      .send({
        email: opEmail,
        password,
        deviceId,
        mobileRole: 'OPERADOR_MOBILE',
      })
      .expect(201);
    expect(res.body.accessToken).toBeDefined();
  });

  it('ciclo gate-in → pátio → gate-out → sync flush', async () => {
    const login = await request(app.getHttpServer()).post('/mobile/v1/auth/login').send({
      email: opEmail,
      password,
      deviceId,
      mobileRole: 'OPERADOR_MOBILE',
    });
    const token = login.body.accessToken as string;

    await request(app.getHttpServer())
      .post('/mobile/v1/operador/gate-in')
      .set('Authorization', `Bearer ${token}`)
      .send({ protocolo })
      .expect(201);

    await request(app.getHttpServer())
      .post('/mobile/v1/operador/patio-evento')
      .set('Authorization', `Bearer ${token}`)
      .send({
        protocolo,
        quadra: `Q${suffix.slice(-3)}`,
        fileira: `F${suffix.slice(-3)}`,
        posicao: `P${suffix.slice(-3)}`,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/mobile/v1/operador/gate-out')
      .set('Authorization', `Bearer ${token}`)
      .send({ protocolo })
      .expect(201);

    const flush = await request(app.getHttpServer())
      .post('/mobile/v1/sync/flush')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);
    expect(flush.body).toMatchObject({ sincronizados: expect.any(Number) });
  });

  it('motorista check-in e solicitacao', async () => {
    const login = await request(app.getHttpServer()).post('/mobile/v1/auth/login').send({
      email: motEmail,
      password,
      deviceId: `${deviceId}-m`,
      mobileRole: 'MOTORISTA',
    });
    expect(login.status).toBe(201);
    const token = login.body.accessToken as string;

    await request(app.getHttpServer())
      .post('/mobile/v1/motorista/checkin')
      .set('Authorization', `Bearer ${token}`)
      .send({ protocolo })
      .expect(201);

    const sol = await request(app.getHttpServer())
      .get('/mobile/v1/motorista/solicitacao')
      .query({ protocolo })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(sol.body).toMatchObject({ protocolo, status: expect.any(String) });
  });

  it('cliente tracking', async () => {
    const login = await request(app.getHttpServer()).post('/mobile/v1/auth/login').send({
      email: cliEmail,
      password,
      deviceId: `${deviceId}-c`,
      mobileRole: 'CLIENTE_APP',
    });
    const token = login.body.accessToken as string;

    const tr = await request(app.getHttpServer())
      .get('/mobile/v1/cliente/tracking')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(tr.body.linhaDoTempo).toBeDefined();
    expect(Array.isArray(tr.body.linhaDoTempo)).toBe(true);
  });

  it('telemetria e admin agregado', async () => {
    const login = await request(app.getHttpServer()).post('/mobile/v1/auth/login').send({
      email: cliEmail,
      password,
      deviceId: `${deviceId}-t`,
      mobileRole: 'CLIENTE_APP',
    });
    const mToken = login.body.accessToken as string;

    await request(app.getHttpServer())
      .post('/mobile/v1/telemetria')
      .set('Authorization', `Bearer ${mToken}`)
      .send({ latenciaMsMedia: 80, usoOffline: false })
      .expect(201);

    const admin = await prisma.user.findUniqueOrThrow({ where: { email: adminEmail } });
    const staff = authService.issueTokens(admin);
    const agg = await request(app.getHttpServer())
      .get('/mobile/v1/admin/telemetria')
      .set('Authorization', `Bearer ${staff.accessToken}`)
      .expect(200);

    expect(agg.body.janelaHoras).toBe(24);
  });

  it('GET /mobile/v2/status', async () => {
    const res = await request(app.getHttpServer()).get('/mobile/v2/status').expect(200);
    expect(res.body.version).toBe('v2');
  });
});
