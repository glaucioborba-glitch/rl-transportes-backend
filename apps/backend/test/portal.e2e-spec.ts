import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { Role, StatusSolicitacao, TipoCliente } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';

/** 14 dígitos únicos por execução (evita colisão com smoke/outros e2e). */
function cnpjUnico(serie: 'a' | 'b') {
  const n = `${serie === 'a' ? '1' : '2'}${Date.now()}${process.hrtime.bigint() % 1000n}`.replace(/\D/g, '');
  return n.padStart(14, '0').slice(-14);
}

describe('Portal do cliente (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  const suffix = `${Date.now()}`;
  const email1 = `e2e-p1-${suffix}@local.test`;
  const email2 = `e2e-p2-${suffix}@local.test`;
  let cliente1Id: string;
  let cliente2Id: string;
  let user1Id: string;
  let user2Id: string;
  let solC1PendId: string;
  let solC1AprovId: string;
  let solC2PendId: string;
  const password = 'E2E@PortalT3st!';

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

    const c1 = await prisma.cliente.create({
      data: {
        nome: `E2E Cliente1 ${suffix}`,
        tipo: TipoCliente.PJ,
        cpfCnpj: cnpjUnico('a'),
        email: `c1-mail-${suffix}@local.test`,
        telefone: '',
        endereco: '',
      },
    });
    const c2 = await prisma.cliente.create({
      data: {
        nome: `E2E Cliente2 ${suffix}`,
        tipo: TipoCliente.PJ,
        cpfCnpj: cnpjUnico('b'),
        email: `c2-mail-${suffix}@local.test`,
        telefone: '',
        endereco: '',
      },
    });
    cliente1Id = c1.id;
    cliente2Id = c2.id;

    const u1 = await prisma.user.create({
      data: {
        email: email1,
        password: hash,
        role: Role.CLIENTE,
        clienteId: cliente1Id,
      },
    });
    const u2 = await prisma.user.create({
      data: {
        email: email2,
        password: hash,
        role: Role.CLIENTE,
        clienteId: cliente2Id,
      },
    });
    user1Id = u1.id;
    user2Id = u2.id;

    const s1 = await prisma.solicitacao.create({
      data: {
        protocolo: `E2E-P1-${suffix}`,
        clienteId: cliente1Id,
        status: StatusSolicitacao.PENDENTE,
      },
    });
    const s2 = await prisma.solicitacao.create({
      data: {
        protocolo: `E2E-A1-${suffix}`,
        clienteId: cliente1Id,
        status: StatusSolicitacao.APROVADO,
      },
    });
    const s3 = await prisma.solicitacao.create({
      data: {
        protocolo: `E2E-C2-${suffix}`,
        clienteId: cliente2Id,
        status: StatusSolicitacao.PENDENTE,
      },
    });
    solC1PendId = s1.id;
    solC1AprovId = s2.id;
    solC2PendId = s3.id;
  });

  afterAll(async () => {
    if (prisma && solC1PendId && solC1AprovId && solC2PendId) {
      await prisma.solicitacao.deleteMany({
        where: { id: { in: [solC1PendId, solC1AprovId, solC2PendId] } },
      });
    }
    if (prisma && user1Id && user2Id) {
      await prisma.auditoria.deleteMany({
        where: { usuario: { in: [user1Id, user2Id] } },
      });
      await prisma.user.deleteMany({ where: { email: { in: [email1, email2] } } });
    }
    if (prisma && cliente1Id) {
      await prisma.cliente.deleteMany({ where: { id: { in: [cliente1Id, cliente2Id].filter(Boolean) } } });
    }
    if (app) await app.close();
  });

  /** Emite JWT como o login, sem Redis (útil quando ioredis não está disponível no CI). */
  async function accessTokenCliente1() {
    const u = await prisma.user.findUnique({ where: { id: user1Id } });
    if (!u) throw new Error('user1 não criado no setup');
    return auth.issueTokens(u).accessToken;
  }

  it('emite accessToken (AuthService.issueTokens) para utilizador CLIENTE', async () => {
    const t = await accessTokenCliente1();
    expect(t.length).toBeGreaterThan(20);
  });

  it('GET /portal/solicitacoes retorna apenas solicitações do vínculo', async () => {
    const token = await accessTokenCliente1();
    const res = await request(app.getHttpServer())
      .get('/portal/solicitacoes')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const ids = (res.body.items as { id: string }[]).map((x) => x.id);
    expect(ids).toContain(solC1PendId);
    expect(ids).toContain(solC1AprovId);
    expect(ids).not.toContain(solC2PendId);
  });

  it('GET /cliente/portal/solicitacoes retorna envelope paginado e escopo do cliente', async () => {
    const token = await accessTokenCliente1();
    const res = await request(app.getHttpServer())
      .get('/cliente/portal/solicitacoes')
      .query({ page: 1, limit: 10 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(typeof res.body.total).toBe('number');
    expect(res.body.total).toBeGreaterThanOrEqual(2);
    const ids = (res.body.items as { id: string }[]).map((x) => x.id);
    expect(ids).toContain(solC1PendId);
    expect(ids).not.toContain(solC2PendId);
  });

  it('GET /portal/solicitacoes/:id de outro cliente retorna 403', async () => {
    const token = await accessTokenCliente1();
    await request(app.getHttpServer())
      .get(`/portal/solicitacoes/${solC2PendId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('GET /portal/solicitacoes/:id com leitura gera rasto READ na auditoria (evento inserido)', async () => {
    const token = await accessTokenCliente1();
    await request(app.getHttpServer())
      .get(`/portal/solicitacoes/${solC1PendId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const reads = await prisma.auditoria.findMany({
      where: { acao: 'READ', registroId: solC1PendId, usuario: user1Id },
    });
    expect(reads.length).toBeGreaterThanOrEqual(1);
  });

  it('PATCH aprovar somente com status PENDENTE', async () => {
    const token = await accessTokenCliente1();
    await request(app.getHttpServer())
      .patch(`/portal/solicitacoes/${solC1AprovId}/aprovar`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/portal/solicitacoes/${solC1PendId}/aprovar`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

});
