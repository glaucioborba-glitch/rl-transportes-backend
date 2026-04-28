import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Dashboard performance (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  const suffix = `${Date.now()}`;
  const gerenteEmail = `e2e-perf-g-${suffix}@local.test`;
  const clienteEmail = `e2e-perf-c-${suffix}@local.test`;
  const password = 'E2E@PerfDash1!';
  let gerenteToken: string;
  let clienteToken: string;

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

    const gerente = await prisma.user.create({
      data: {
        email: gerenteEmail,
        password: hash,
        role: Role.GERENTE,
      },
    });
    const cliente = await prisma.user.create({
      data: {
        email: clienteEmail,
        password: hash,
        role: Role.CLIENTE,
      },
    });

    gerenteToken = auth.issueTokens(gerente).accessToken;
    clienteToken = auth.issueTokens(cliente).accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [gerenteEmail, clienteEmail] } },
    });
    await app.close();
  });

  it('GET /dashboard-performance com GERENTE retorna agregados', async () => {
    const res = await request(app.getHttpServer())
      .get('/dashboard-performance')
      .set('Authorization', `Bearer ${gerenteToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('estrategicos');
    expect(res.body).toHaveProperty('produtividadeHumana');
    expect(res.body).toHaveProperty('gargalos');
    expect(res.body).toHaveProperty('series');
    expect(res.body.estrategicos).toHaveProperty('throughputPortaria');
    expect(res.body.margemCusto).not.toBeNull();
  });

  it('GET /dashboard-performance sem token retorna 401', async () => {
    await request(app.getHttpServer()).get('/dashboard-performance').expect(401);
  });

  it('GET /dashboard-performance como CLIENTE retorna 403', async () => {
    await request(app.getHttpServer())
      .get('/dashboard-performance')
      .set('Authorization', `Bearer ${clienteToken}`)
      .expect(403);
  });
});
