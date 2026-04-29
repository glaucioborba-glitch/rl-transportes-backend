import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { applyBaseHttpStack } from '../src/http/http-stack';

describe('Security hardening (e2e)', () => {
  let app: INestApplication;
  let prevCors: string | undefined;
  let prevCsrf: string | undefined;

  beforeAll(async () => {
    prevCors = process.env.CORS_ORIGIN;
    prevCsrf = process.env.CSRF_ENABLED;
    process.env.CORS_ORIGIN = 'http://localhost:3001';
    process.env.CSRF_ENABLED = '1';

    const { AppModule } = await import('../src/app.module');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    applyBaseHttpStack(app);
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    if (prevCors === undefined) delete process.env.CORS_ORIGIN;
    else process.env.CORS_ORIGIN = prevCors;
    if (prevCsrf === undefined) delete process.env.CSRF_ENABLED;
    else process.env.CSRF_ENABLED = prevCsrf;
  });

  it('preflight OPTIONS reflete origem permitida (CORS)', () => {
    return request(app.getHttpServer())
      .options('/health')
      .set('Origin', 'http://localhost:3001')
      .set('Access-Control-Request-Method', 'GET')
      .expect(204)
      .expect('Access-Control-Allow-Origin', 'http://localhost:3001')
      .expect('Access-Control-Allow-Credentials', 'true');
  });

  it('GET /health define cookie CSRF quando CSRF_ENABLED=1', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    const setCookie = res.headers['set-cookie'];
    const joined = Array.isArray(setCookie) ? setCookie.join(';') : String(setCookie || '');
    expect(joined).toMatch(/rl_csrf=/);
  });

  it('POST mutável sem CSRF retorna 403', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.get('/health').expect(200);
    await agent
      .post('/solicitacoes')
      .set('Content-Type', 'application/json')
      .send({})
      .expect(403);
});

  it('POST mutável com par CSRF válido prossegue até auth (401)', async () => {
    const agent = request.agent(app.getHttpServer());
    const g = await agent.get('/health').expect(200);
    const raw = g.headers['set-cookie'];
    const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const csrfCookie = cookies.map((c) => c.split(';')[0]).find((c) => c.startsWith('rl_csrf='));
    expect(csrfCookie).toBeDefined();
    const token = csrfCookie!.split('=')[1];
    await agent
      .post('/solicitacoes')
      .set('X-CSRF-Token', token)
      .set('Content-Type', 'application/json')
      .send({})
      .expect(401);
  });
});
