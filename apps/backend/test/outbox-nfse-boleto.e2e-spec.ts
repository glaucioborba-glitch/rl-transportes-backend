import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import {
  OutboxEventStatus,
  Role,
  StatusContainer,
  StatusPagamentoFatura,
  StatusPreFatura,
  StatusSolicitacao,
  TipoCaminhao,
  TurnoAgendamento,
} from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';
import { OutboxWorker } from '../src/outbox/outbox.worker';
import {
  DEFAULT_VALOR_DIARIA,
  DEFAULT_VALOR_SERVICOS_EXTRAS,
} from '../src/armazenagem-faturamento/armazenagem-billing.util';
import { clienteE2eDefaults } from './helpers/e2e-cliente.factory';
import { ensureE2ePricingTable } from './helpers/e2e-pricing.factory';
import { cpfCnpjForTestUser } from './helpers/e2e-user.factory';

const PLACA_CAVALO = 'ABC1D23';
const PLACA_CARRETA = 'DEF4G56';
const MOTORISTA_CPF = '52998224725';
const CONTAINER_ISO = 'MSKU7654321';
const PESSOA_CPF = '39053344705';

/**
 * H9 — E2E: Gate-Out → outbox EMITIR_NFSE_BOLETO → sandbox NFS-e/boleto → AGUARDANDO_PAGAMENTO
 * + exposição no portal GET /cliente/portal/financeiro/faturas-armazenagem
 */
describe('Outbox NFS-e + boleto (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  let worker: OutboxWorker;
  const suffix = `${Date.now()}`;
  const clienteEmail = `e2e-outbox-${suffix}@local.test`;
  const opEmail = `e2e-outbox-op-${suffix}@local.test`;
  const adminEmail = `e2e-outbox-adm-${suffix}@local.test`;
  const portalSenha = 'OutboxE2E@T3st!';
  let clienteId: string;
  let clienteDoc: string;
  let operadorId: string;
  let adminId: string;
  let tokenOp: string;
  let solicitacaoId: string;
  let pessoaId: string;

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
    worker = app.get(OutboxWorker);
    const hash = await bcrypt.hash(portalSenha, 10);
    clienteDoc = cpfCnpjForTestUser(clienteEmail);

    const cliente = await prisma.cliente.create({
      data: clienteE2eDefaults({
        razaoSocial: `E2E Outbox H9 ${suffix}`,
        cpfCnpj: clienteDoc,
        email: clienteEmail,
        emailNfse: clienteEmail,
      }),
    });
    clienteId = cliente.id;

    await ensureE2ePricingTable(prisma, {
      clienteId,
      freeTimeDias: 0,
      valorDiaria: DEFAULT_VALOR_DIARIA,
      valorServicosExtras: DEFAULT_VALOR_SERVICOS_EXTRAS,
    });

    const pessoa = await prisma.pessoaAutorizada.create({
      data: {
        clienteId,
        nome: 'Financeiro E2E',
        email: clienteEmail,
        cpf: PESSOA_CPF,
        permissoes: {
          create: {
            podeVisualizarFinanceiro: true,
            podeCriarSolicitacao: true,
            podeVerOS: true,
          },
        },
      },
    });
    pessoaId = pessoa.id;

    await prisma.user.create({
      data: {
        cpfCnpj: clienteDoc,
        email: clienteEmail,
        password: hash,
        role: Role.CLIENTE,
        clienteId,
      },
    });

    const op = await prisma.user.create({
      data: {
        cpfCnpj: cpfCnpjForTestUser(opEmail),
        email: opEmail,
        password: hash,
        role: Role.OPERADOR_GATE,
      },
    });
    operadorId = op.id;
    tokenOp = auth.issueTokens(op).accessToken;

    const adm = await prisma.user.create({
      data: {
        cpfCnpj: cpfCnpjForTestUser(adminEmail),
        email: adminEmail,
        password: hash,
        role: Role.ADMIN,
      },
    });
    adminId = adm.id;

    const sol = await prisma.solicitacao.create({
      data: {
        protocolo: `E2E-OUTBOX-${suffix}`,
        clienteId,
        status: StatusSolicitacao.AGUARDANDO_GATE_IN,
        transporteSolicitacao: {
          create: {
            nomeMotorista: 'Outbox E2E',
            cpfMotorista: MOTORISTA_CPF,
            tipoCaminhao: TipoCaminhao.LS,
            placaCavalo: PLACA_CAVALO,
            placaCarreta01: PLACA_CARRETA,
          },
        },
        containersSolicitacao: {
          create: [
            {
              unidade: CONTAINER_ISO,
              booking: `BK-O-${suffix}`,
              processo: `PR-O-${suffix}`,
              tamanho: '40',
              tipo: 'DRY',
              status: StatusContainer.CHEIO,
              ordem: 1,
            },
          ],
        },
        agendamentoSolicitacao: {
          create: {
            dataRef: new Date(),
            turno: TurnoAgendamento.MANHA,
          },
        },
      },
    });
    solicitacaoId = sol.id;
  }, 120_000);

  afterAll(async () => {
    if (prisma && clienteId) {
      await prisma.auditoria.deleteMany({
        where: { tabela: 'faturas_armazenagem' },
      });
      await prisma.outboxEvent.deleteMany({ where: { aggregateType: 'FaturaArmazenagem' } });
      await prisma.boleto.deleteMany({ where: { faturamento: { clienteId } } });
      await prisma.nfsEmitida.deleteMany({ where: { faturamento: { clienteId } } });
      await prisma.faturamento.deleteMany({ where: { clienteId } });
      await prisma.fatura.deleteMany({ where: { clienteId } });
      await prisma.preFatura.deleteMany({ where: { clienteId } });
      if (pessoaId) {
        await prisma.permissaoPessoaAutorizada.deleteMany({ where: { pessoaId } });
        await prisma.pessoaAutorizada.deleteMany({ where: { id: pessoaId } });
      }
      if (solicitacaoId) {
        await prisma.gateCheckOut.deleteMany({ where: { gateIn: { solicitacaoId } } });
        await prisma.gateCheckIn.deleteMany({ where: { solicitacaoId } });
        await prisma.patioUnidade.deleteMany({ where: { solicitacaoId } });
        await prisma.solicitacao.deleteMany({ where: { id: solicitacaoId } });
      }
      await prisma.cliente.update({ where: { id: clienteId }, data: { tabelaPrecoId: null } });
      await prisma.regraTarifaria.deleteMany({
        where: { tabelaPreco: { clientes: { some: { id: clienteId } } } },
      });
      await prisma.tabelaPreco.deleteMany({ where: { clientes: { some: { id: clienteId } } } });
      await prisma.user.deleteMany({ where: { clienteId } });
      await prisma.cliente.deleteMany({ where: { id: clienteId } });
    }
    if (adminId) await prisma.user.deleteMany({ where: { id: adminId } });
    if (operadorId) await prisma.user.deleteMany({ where: { id: operadorId } });
    if (app) await app.close();
  });

  async function gateOutCompleto(): Promise<string> {
    const checkInRes = await request(app.getHttpServer())
      .post(`/v2/gate/solicitacoes/${solicitacaoId}/check-in`)
      .set('Authorization', `Bearer ${tokenOp}`)
      .field('data', JSON.stringify({
        placaCavalo: PLACA_CAVALO,
        placaCarreta01: PLACA_CARRETA,
        motoristaNome: 'Outbox E2E',
        motoristaCpf: MOTORISTA_CPF,
      }))
      .attach('fotos', Buffer.from('fake-jpeg'), { filename: 'e.jpg', contentType: 'image/jpeg' })
      .expect(201);

    const gateInId = checkInRes.body.id as string;
    const tresDiasAtras = new Date(Date.now() - 3 * 86_400_000);
    await prisma.gateCheckIn.update({
      where: { id: gateInId },
      data: { dataHora: tresDiasAtras },
    });
    await prisma.preFatura.updateMany({
      where: { gateInId },
      data: { gateInAt: tresDiasAtras },
    });

    await request(app.getHttpServer())
      .post(`/v2/gate/check-ins/${gateInId}/check-out`)
      .set('Authorization', `Bearer ${tokenOp}`)
      .field('data', JSON.stringify({}))
      .attach('fotos', Buffer.from('fake-jpeg-out'), { filename: 's.jpg', contentType: 'image/jpeg' })
      .expect(201);

    const fatura = await prisma.fatura.findFirst({ where: { clienteId } });
    expect(fatura).toBeTruthy();
    return fatura!.id;
  }

  it('gate-out enfileira EMITIR_NFSE_BOLETO', async () => {
    const faturaId = await gateOutCompleto();
    const evt = await prisma.outboxEvent.findFirst({
      where: { aggregateId: faturaId, eventType: 'EMITIR_NFSE_BOLETO' },
    });
    expect(evt).toBeTruthy();
    expect(evt!.status).toBe(OutboxEventStatus.PENDING);
  }, 120_000);

  it('worker processa outbox sandbox → AGUARDANDO_PAGAMENTO + links', async () => {
    const faturas = await prisma.fatura.findMany({ where: { clienteId } });
    expect(faturas.length).toBeGreaterThanOrEqual(1);
    const faturaId = faturas[0]!.id;

    await worker.tick();

    const fatura = await prisma.fatura.findUnique({ where: { id: faturaId } });
    expect(fatura?.statusPagamento).toBe(StatusPagamentoFatura.AGUARDANDO_PAGAMENTO);
    expect(fatura?.linkNfse).toBeTruthy();
    expect(fatura?.linkBoleto).toBeTruthy();
    expect(fatura?.linkPix).toBeTruthy();

    const evt = await prisma.outboxEvent.findFirst({
      where: { aggregateId: faturaId, eventType: 'EMITIR_NFSE_BOLETO' },
    });
    expect(evt?.status).toBe(OutboxEventStatus.PROCESSED);
  }, 120_000);

  it('GET faturas-armazenagem expõe links (ADMIN + CLIENTE com pessoa)', async () => {
    const adm = await prisma.user.findUnique({ where: { id: adminId } });
    const adminToken = auth.issueTokens(adm!).accessToken;

    const adminRes = await request(app.getHttpServer())
      .get('/cliente/portal/financeiro/faturas-armazenagem')
      .query({ clienteId })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(adminRes.body)).toBe(true);
    expect(adminRes.body.length).toBeGreaterThanOrEqual(1);
    const row = adminRes.body[0] as {
      id: string;
      linkNfse: string;
      linkBoleto: string;
      linkPix: string;
      statusPagamento: string;
    };
    expect(row.statusPagamento).toBe('AGUARDANDO_PAGAMENTO');
    expect(row.linkNfse).toBeTruthy();
    expect(row.linkBoleto).toBeTruthy();
    expect(row.linkPix).toBeTruthy();

    const login = await request(app.getHttpServer())
      .post('/portal/login')
      .send({ documento: clienteDoc, password: portalSenha, papel: 'CLIENTE', tenantId: 'default' })
      .expect(201);
    const portalToken = login.body.accessToken as string;

    await request(app.getHttpServer())
      .post('/portal/auth/validar-pessoa')
      .set('Authorization', `Bearer ${portalToken}`)
      .send({ cpf: PESSOA_CPF })
      .expect(200);

    const clienteRes = await request(app.getHttpServer())
      .get('/cliente/portal/financeiro/faturas-armazenagem')
      .set('Authorization', `Bearer ${portalToken}`)
      .expect(200);

    expect(clienteRes.body.some((r: { id: string }) => r.id === row.id)).toBe(true);
  }, 120_000);
});
