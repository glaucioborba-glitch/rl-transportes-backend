import { cpfCnpjForTestUser } from './helpers/e2e-user.factory';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { Role, TipoCliente } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';
import { clienteE2eDefaults } from './helpers/e2e-cliente.factory';

describe('CX Portais Fase 20 (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = `${Date.now()}`;
  const cxClientEmail = `cxcli-${suffix}@local.test`;
  const cxOpEmail = `cxop-${suffix}@local.test`;
  const cxAdminEmail = `cxadm-${suffix}@local.test`;
  const fornecedorEmail = `cxfno-${suffix}@local.test`;
  let userClienteId: string;
  let clienteId: string;
  let userOpId: string;
  let userAdminId: string;
  let clienteDoc: string;
  let fornecedorDoc: string;
  const password = 'CxPortalE2E@1';

  beforeAll(async () => {
    clienteDoc = cpfCnpjForTestUser(cxClientEmail);
    fornecedorDoc = cpfCnpjForTestUser(fornecedorEmail);
    process.env.CX_PORTAL_FORNECEDOR_SEED = `${fornecedorDoc}|${password}|default|FORNECEDOR`;

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
    const hash = await bcrypt.hash(password, 10);

    const cliente = await prisma.cliente.create({
      data: clienteE2eDefaults({
        razaoSocial: 'Cliente CX E2E',
        nomeFantasia: 'CX Fantasia',
        tipo: TipoCliente.PJ,
        cpfCnpj: clienteDoc,
        email: `cli-${suffix}@local.test`,
        emailNfse: `nfse-cli-${suffix}@local.test`,
      }),
    });
    clienteId = cliente.id;

    const [uc, uo, ua] = await Promise.all([
      prisma.user.create({
        data: {
          cpfCnpj: clienteDoc,
          email: cxClientEmail,
          password: hash,
          role: Role.CLIENTE,
          clienteId: cliente.id,
        },
      }),
      prisma.user.create({
        data: {
          cpfCnpj: cpfCnpjForTestUser(cxOpEmail),
          email: cxOpEmail,
          password: hash,
          role: Role.OPERADOR_GATE,
        },
      }),
      prisma.user.create({
        data: {
          cpfCnpj: cpfCnpjForTestUser(cxAdminEmail),
          email: cxAdminEmail,
          password: hash,
          role: Role.ADMIN,
        },
      }),
    ]);
    userClienteId = uc.id;
    userOpId = uo.id;
    userAdminId = ua.id;
  });

  afterAll(async () => {
    const ids = [userClienteId, userOpId, userAdminId].filter(Boolean) as string[];
    if (prisma && ids.length) {
      await prisma.auditoria.deleteMany({ where: { usuario: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    if (prisma && clienteId) {
      await prisma.cliente.deleteMany({ where: { id: clienteId } });
    }
    delete process.env.CX_PORTAL_FORNECEDOR_SEED;
    if (app) await app.close();
  });

  it('403 com apenas X-Public-Api-Key na rota do portal cliente', async () => {
    await request(app.getHttpServer())
      .get('/cliente/portal/dashboard')
      .set('X-Public-Api-Key', 'pk')
      .expect(403);
  });

  it('login portal CLIENTE e GET dashboard', async () => {
    const login = await request(app.getHttpServer())
      .post('/portal/login')
      .send({ documento: clienteDoc, password, papel: 'CLIENTE', tenantId: 'default' })
      .expect(201);
    const token = login.body.accessToken as string;
    expect(token).toBeDefined();

    const dash = await request(app.getHttpServer())
      .get('/cliente/portal/dashboard')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(dash.body.cliente?.id).toBe(clienteId);
  });

  it('OPERADOR com JWT corporativo recebe 403 no portal cliente', async () => {
    const auth = app.get(AuthService);
    const u = await prisma.user.findUnique({ where: { id: userOpId } });
    const tok = auth.issueTokens(u!).accessToken;

    await request(app.getHttpServer())
      .get('/cliente/portal/dashboard')
      .set('Authorization', `Bearer ${tok}`)
      .expect(403);
  });

  it('fornecedor login e GET contratos', async () => {
    const login = await request(app.getHttpServer())
      .post('/portal/login')
      .send({ documento: fornecedorDoc, password, papel: 'FORNECEDOR' })
      .expect(201);
    const token = login.body.accessToken as string;

    const r = await request(app.getHttpServer())
      .get('/fornecedor/portal/contratos')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(Array.isArray(r.body)).toBe(true);
  });

  it('staff ADMIN: analytics + branding POST', async () => {
    const auth = app.get(AuthService);
    const u = await prisma.user.findUnique({ where: { id: userAdminId } });
    const tok = auth.issueTokens(u!).accessToken;

    await request(app.getHttpServer())
      .get('/portal/analytics')
      .set('Authorization', `Bearer ${tok}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/portal/branding')
      .set('Authorization', `Bearer ${tok}`)
      .send({
        tenantId: 'default',
        cores: { primaria: '#112233', secundaria: '#445566' },
        tema: 'dark',
      })
      .expect(201);

    const b = await request(app.getHttpServer())
      .get('/portal/branding?tenantId=default')
      .set('Authorization', `Bearer ${tok}`)
      .expect(200);
    expect(b.body.tema).toBe('dark');
  });
});
