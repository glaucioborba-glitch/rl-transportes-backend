import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';

describe('Comercial pricing (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  const suffix = `${Date.now()}`;
  const gerenteEmail = `e2e-com-${suffix}@local.test`;
  const opEmail = `e2e-com-op-${suffix}@local.test`;
  const password = 'E2E@ComPricing1!';
  let tokenGerente: string;
  let tokenOp: string;

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

    const g = await prisma.user.create({
      data: { email: gerenteEmail, password: hash, role: Role.GERENTE },
    });
    const o = await prisma.user.create({
      data: { email: opEmail, password: hash, role: Role.OPERADOR_GATE },
    });

    tokenGerente = auth.issueTokens(g).accessToken;
    tokenOp = auth.issueTokens(o).accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [gerenteEmail, opEmail] } },
    });
    await app.close();
  });

  it('GET /comercial/curva-abc com GERENTE retorna 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/comercial/curva-abc')
      .set('Authorization', `Bearer ${tokenGerente}`)
      .expect(200);

    expect(res.body).toHaveProperty('itens');
    expect(res.body).toHaveProperty('parametros');
    expect(res.body).toHaveProperty('concentracao');
  });

  it('GET /comercial/simulador com query completa retorna projeção', async () => {
    const res = await request(app.getHttpServer())
      .get('/comercial/simulador')
      .query({
        precoAtual: 100,
        precoNovo: 110,
        custo: 40,
        volumeAtual: 100,
      })
      .set('Authorization', `Bearer ${tokenGerente}`)
      .expect(200);

    expect(res.body).toHaveProperty('margemNova');
    expect(res.body).toHaveProperty('impactoVolumeEstimado');
  });

  it('GET /comercial/curva-abc como OPERADOR retorna 403', async () => {
    await request(app.getHttpServer())
      .get('/comercial/curva-abc')
      .set('Authorization', `Bearer ${tokenOp}`)
      .expect(403);
  });

  it('GET /comercial/curva-abc sem token retorna 401', async () => {
    await request(app.getHttpServer()).get('/comercial/curva-abc').expect(401);
  });
});
