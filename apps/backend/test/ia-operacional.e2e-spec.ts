import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { Role, TipoUnidade } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';

const PNG_1PX =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAKmKm+QAAAABJRU5ErkJggg==';

describe('IA operacional (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  const suffix = `${Date.now()}`;
  const emailGerente = `e2e-ia-gr-${suffix}@local.test`;
  const emailGate = `e2e-ia-gt-${suffix}@local.test`;
  const emailCliente = `e2e-ia-cl-${suffix}@local.test`;
  const password = 'E2E@IaOpPhase41!';
  let tokenGerente: string;
  let tokenGate: string;
  let tokenCliente: string;

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
      data: { email: emailGerente, password: hash, role: Role.GERENTE },
    });
    const gt = await prisma.user.create({
      data: { email: emailGate, password: hash, role: Role.OPERADOR_GATE },
    });
    const c = await prisma.user.create({
      data: { email: emailCliente, password: hash, role: Role.CLIENTE },
    });

    tokenGerente = auth.issueTokens(g).accessToken;
    tokenGate = auth.issueTokens(gt).accessToken;
    tokenCliente = auth.issueTokens(c).accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [emailGerente, emailGate, emailCliente] } },
    });
    await app.close();
  });

  it('GET /ia/gargalos GERENTE 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/ia/gargalos')
      .set('Authorization', `Bearer ${tokenGerente}`)
      .expect(200);

    expect(res.body).toHaveProperty('horizontes');
    expect(res.body.horizontes.length).toBe(3);
    expect(res.body).toHaveProperty('metricasConfianca');
    expect(res.body).toHaveProperty('tendencia');
    expect(res.body).toHaveProperty('sazonaliade');
  });

  it('GET /ia/ciclo-previsto GERENTE 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/ia/ciclo-previsto')
      .query({
        tipoUnidade: TipoUnidade.IMPORT,
        horarioChegada: '2026-04-28T14:00:00.000Z',
      })
      .set('Authorization', `Bearer ${tokenGerente}`)
      .expect(200);

    expect(res.body).toHaveProperty('previstoMinutos');
    expect(res.body).toHaveProperty('amostrasConsideradas');
  });

  it('GET /ia/produtividade-operador GERENTE 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/ia/produtividade-operador')
      .query({ turno: 'MANHA' })
      .set('Authorization', `Bearer ${tokenGerente}`)
      .expect(200);

    expect(res.body.turno).toBe('MANHA');
    expect(res.body).toHaveProperty('produtividadePrevistaOpsHora');
  });

  it('POST /ia/ocr/gate JSON GERENTE 200', async () => {
    const res = await request(app.getHttpServer())
      .post('/ia/ocr/gate')
      .set('Authorization', `Bearer ${tokenGerente}`)
      .send({ imagemBase64: PNG_1PX })
      .expect(200);

    expect(res.body).toHaveProperty('providerUsado');
    expect(typeof res.body.numeroIsoValido6346).toBe('boolean');
  });

  it('GET /ia/patio/recomendacoes GATE 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/ia/patio/recomendacoes')
      .set('Authorization', `Bearer ${tokenGate}`)
      .expect(200);

    expect(res.body).toHaveProperty('hotspots');
    expect(res.body).toHaveProperty('recomendacoes');
  });

  it('GET /ia/gargalos OPERADOR_GATE 403', async () => {
    await request(app.getHttpServer())
      .get('/ia/gargalos')
      .set('Authorization', `Bearer ${tokenGate}`)
      .expect(403);
  });

  it('GET /ia/ciclo-previsto OPERADOR_GATE 403', async () => {
    await request(app.getHttpServer())
      .get('/ia/ciclo-previsto')
      .query({
        tipoUnidade: TipoUnidade.IMPORT,
        horarioChegada: '2026-04-28T14:00:00.000Z',
      })
      .set('Authorization', `Bearer ${tokenGate}`)
      .expect(403);
  });

  it('POST /ia/ocr/gate OPERADOR_GATE 200', async () => {
    await request(app.getHttpServer())
      .post('/ia/ocr/gate')
      .set('Authorization', `Bearer ${tokenGate}`)
      .send({ imagemBase64: PNG_1PX })
      .expect(200);
  });

  it('POST /ia/ocr/gate/upload multipart GATE 200', async () => {
    await request(app.getHttpServer())
      .post('/ia/ocr/gate/upload')
      .set('Authorization', `Bearer ${tokenGate}`)
      .attach('imagem', Buffer.from(PNG_1PX, 'base64'), 't.png')
      .expect(200);
  });

  it('GET /ia/patio/recomendacoes CLIENTE 403', async () => {
    await request(app.getHttpServer())
      .get('/ia/patio/recomendacoes')
      .set('Authorization', `Bearer ${tokenCliente}`)
      .expect(403);
  });

  it('GET /ia/gargalos sem token 401', async () => {
    await request(app.getHttpServer()).get('/ia/gargalos').expect(401);
  });
});
