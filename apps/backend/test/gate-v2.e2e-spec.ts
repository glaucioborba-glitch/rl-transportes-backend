import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import {
  Role,
  StatusContainer,
  StatusPreFatura,
  StatusSolicitacao,
  TipoCaminhao,
  TurnoAgendamento,
} from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';
import { hasConsolidatedPreFaturaForIso } from '../src/armazenagem-faturamento/billing-coexistence.util';
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
const CONTAINER_ISO = 'MSKU1234567';

/**
 * H2 — E2E Gate-v2: check-in multipart → estadia 3d → check-out → 1 fatura (3 diárias).
 * H5 — coexistência billing permanece coberta no primeiro caso.
 */
describe('Gate-v2 FSM + billing (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  const suffix = `${Date.now()}`;
  const email = `e2e-gate-${suffix}@local.test`;
  const opEmail = `e2e-gate-op-${suffix}@local.test`;
  let clienteId: string;
  let operadorId: string;
  let tokenOp: string;
  let solicitacaoId: string;

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
    const hash = await bcrypt.hash('GateE2E@T3st!', 10);

    const cliente = await prisma.cliente.create({
      data: clienteE2eDefaults({
        razaoSocial: `E2E Gate Billing ${suffix}`,
        cpfCnpj: cpfCnpjForTestUser(email),
        email,
        emailNfse: email,
      }),
    });
    clienteId = cliente.id;

    await ensureE2ePricingTable(prisma, {
      clienteId,
      freeTimeDias: 0,
      valorDiaria: DEFAULT_VALOR_DIARIA,
      valorServicosExtras: DEFAULT_VALOR_SERVICOS_EXTRAS,
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

    const sol = await prisma.solicitacao.create({
      data: {
        protocolo: `E2E-GATE-${suffix}`,
        clienteId,
        status: StatusSolicitacao.AGUARDANDO_GATE_IN,
        transporteSolicitacao: {
          create: {
            nomeMotorista: 'João E2E',
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
              booking: `BK-${suffix}`,
              processo: `PR-${suffix}`,
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
      await prisma.outboxEvent.deleteMany({
        where: { aggregateType: 'FaturaArmazenagem' },
      });
      await prisma.fatura.deleteMany({ where: { clienteId } });
      await prisma.preFatura.deleteMany({ where: { clienteId } });
      if (solicitacaoId) {
        await prisma.gateCheckOut.deleteMany({
          where: { gateIn: { solicitacaoId } },
        });
        await prisma.gateCheckIn.deleteMany({ where: { solicitacaoId } });
        await prisma.patioUnidade.deleteMany({ where: { solicitacaoId } });
        await prisma.solicitacao.deleteMany({ where: { id: solicitacaoId } });
      }
      await prisma.cliente.update({ where: { id: clienteId }, data: { tabelaPrecoId: null } });
      await prisma.regraTarifaria.deleteMany({
        where: { tabelaPreco: { clientes: { some: { id: clienteId } } } },
      });
      await prisma.tabelaPreco.deleteMany({ where: { clientes: { some: { id: clienteId } } } });
      await prisma.cliente.deleteMany({ where: { id: clienteId } });
    }
    if (operadorId) {
      await prisma.user.deleteMany({ where: { id: operadorId } });
    }
    if (app) await app.close();
  });

  it('hasConsolidatedPreFaturaForIso retorna true após pré-fatura CONSOLIDADA', async () => {
    const iso = `E2E${suffix}`.slice(0, 11).toUpperCase();
    const solCoexist = await prisma.solicitacao.create({
      data: {
        protocolo: `E2E-COEX-${suffix}`,
        clienteId,
        status: StatusSolicitacao.EM_PATIO,
        transporteSolicitacao: {
          create: {
            nomeMotorista: 'Coexist',
            cpfMotorista: MOTORISTA_CPF,
            tipoCaminhao: TipoCaminhao.LS,
            placaCavalo: PLACA_CAVALO,
            placaCarreta01: PLACA_CARRETA,
          },
        },
      },
    });
    const gi = await prisma.gateCheckIn.create({
      data: {
        solicitacaoId: solCoexist.id,
        operadorId,
        placaCavalo: PLACA_CAVALO,
        placaCarreta01: PLACA_CARRETA,
        motoristaNome: 'Coexist E2E',
        motoristaCpf: MOTORISTA_CPF,
        dataHora: new Date(Date.now() - 10 * 86_400_000),
      },
    });
    await prisma.preFatura.create({
      data: {
        containerIso: iso,
        clienteId,
        gateInId: gi.id,
        gateInAt: gi.dataHora,
        valorAcumulado: 100,
        diasCobrados: 1,
        status: StatusPreFatura.CONSOLIDADA,
      },
    });

    const hit = await hasConsolidatedPreFaturaForIso(prisma, iso, clienteId);
    expect(hit).toBe(true);

    await prisma.preFatura.deleteMany({ where: { gateInId: gi.id } });
    await prisma.gateCheckIn.delete({ where: { id: gi.id } });
    await prisma.solicitacao.delete({ where: { id: solCoexist.id } });
  });

  it('GET /health responde ok (gate module carregado no AppModule)', () => {
    return request(app.getHttpServer()).get('/health').expect(200);
  });

  it('ciclo completo: check-in → 3 dias pátio → check-out → CONCLUIDO + 1 fatura (3 diárias)', async () => {
    const checkInPayload = {
      placaCavalo: PLACA_CAVALO,
      placaCarreta01: PLACA_CARRETA,
      motoristaNome: 'João E2E',
      motoristaCpf: MOTORISTA_CPF,
    };

    const checkInRes = await request(app.getHttpServer())
      .post(`/v2/gate/solicitacoes/${solicitacaoId}/check-in`)
      .set('Authorization', `Bearer ${tokenOp}`)
      .field('data', JSON.stringify(checkInPayload))
      .attach('fotos', Buffer.from('fake-jpeg-bytes'), {
        filename: 'avaria-entrada.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201);

    const gateInId = checkInRes.body.id as string;
    expect(gateInId).toBeTruthy();

    const emPatio = await prisma.solicitacao.findUnique({ where: { id: solicitacaoId } });
    expect(emPatio?.status).toBe(StatusSolicitacao.EM_PATIO);

    const gateCheckIn = await prisma.gateCheckIn.findUnique({ where: { id: gateInId } });
    expect(gateCheckIn).toBeTruthy();
    expect(gateCheckIn!.operadorId).toBe(operadorId);

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
      .attach('fotos', Buffer.from('fake-jpeg-saida'), {
        filename: 'avaria-saida.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201);

    const solFinal = await prisma.solicitacao.findUnique({ where: { id: solicitacaoId } });
    expect(solFinal?.status).toBe(StatusSolicitacao.CONCLUIDO);

    const faturas = await prisma.fatura.findMany({ where: { clienteId } });
    expect(faturas).toHaveLength(1);
    expect(Number(faturas[0].valorTotal)).toBe(3 * DEFAULT_VALOR_DIARIA + DEFAULT_VALOR_SERVICOS_EXTRAS);

    const preFaturas = await prisma.preFatura.findMany({ where: { gateInId } });
    expect(preFaturas).toHaveLength(1);
    expect(preFaturas[0].status).toBe(StatusPreFatura.CONSOLIDADA);
    expect(preFaturas[0].diasCobrados).toBe(3);
  }, 120_000);
});
