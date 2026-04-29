import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('App (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/health (GET) retorna checks de database e redis', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(['ok', 'degraded']).toContain(res.body.status);
        expect(res.body).toHaveProperty('checks');
        expect(res.body.checks).toHaveProperty('database');
        expect(res.body.checks).toHaveProperty('redis');
        expect(res.body).toHaveProperty('timestamp');
      });
  });

  it('GET /auth/me sem token retorna 401 (RBAC, não só JWT)', () => {
    return request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('GET /nfse/:id sem token retorna 401', () => {
    return request(app.getHttpServer())
      .get('/nfse/0000000000000000000000000000000000000000')
      .expect(401);
  });

  it('rotas de solicitações, faturamento e clientes exigem JWT (smoke)', async () => {
    await request(app.getHttpServer()).get('/solicitacoes').expect(401);
    await request(app.getHttpServer()).get('/faturamento').expect(401);
    await request(app.getHttpServer()).get('/clientes').expect(401);
  });
});
