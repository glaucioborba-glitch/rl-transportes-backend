import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import {
  Role,
  StatusBloqueioContainer,
  StatusContainer,
  StatusSolicitacao,
  TipoBloqueioContainer,
  TipoCaminhao,
  TurnoAgendamento,
} from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';
import { HoldReleaseService } from '../src/hold-release/hold-release.service';
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
const CONTAINER_ISO = 'MSKU4455667';

function attachVistoriaFotos(req: request.Test): request.Test {
  const buf = Buffer.from('fake-jpeg-bytes');
  return req
    .attach('foto_FRENTE', buf, { filename: 'frente.jpg', contentType: 'image/jpeg' })
    .attach('foto_TRASEIRA', buf, { filename: 'traseira.jpg', contentType: 'image/jpeg' })
    .attach('foto_LATERAL_DIREITA', buf, { filename: 'dir.jpg', contentType: 'image/jpeg' })
    .attach('foto_LATERAL_ESQUERDA', buf, { filename: 'esq.jpg', contentType: 'image/jpeg' });
}

describe('Gate-out hold release (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  let holdRelease: HoldReleaseService;

  const suffix = `${Date.now()}`;
  const email = `e2e-hold-${suffix}@local.test`;
  const opEmail = `e2e-hold-op-${suffix}@local.test`;
  let clienteId: string;
  let operadorId: string;
  let tokenOp: string;
  let solicitacaoId: string;
  let gateInId: string;
  let bloqueioId: string;

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
    holdRelease = app.get(HoldReleaseService);

    const hash = await bcrypt.hash('HoldE2E@T3st!', 10);
    const cliente = await prisma.cliente.create({
      data: clienteE2eDefaults({
        razaoSocial: `E2E Hold Gate ${suffix}`,
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
        protocolo: `E2E-HOLD-${suffix}`,
        clienteId,
        status: StatusSolicitacao.AGUARDANDO_GATE_IN,
        transporteSolicitacao: {
          create: {
            nomeMotorista: 'Hold E2E',
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
          create: { dataRef: new Date(), turno: TurnoAgendamento.MANHA },
        },
      },
    });
    solicitacaoId = sol.id;

    const checkInReq = request(app.getHttpServer())
      .post(`/v2/gate/solicitacoes/${solicitacaoId}/check-in`)
      .set('Authorization', `Bearer ${tokenOp}`)
      .field(
        'data',
        JSON.stringify({
          placaCavalo: PLACA_CAVALO,
          placaCarreta01: PLACA_CARRETA,
          motoristaNome: 'Hold E2E',
          motoristaCpf: MOTORISTA_CPF,
        }),
      );
    const checkInRes = await attachVistoriaFotos(checkInReq).expect(201);
    gateInId = checkInRes.body.id as string;

    const bloqueio = await holdRelease.aplicarBloqueio({
      solicitacaoId,
      tipo: TipoBloqueioContainer.FINANCEIRO,
      motivo: 'Inadimplência simulada E2E',
      bloqueadoPorId: operadorId,
    });
    bloqueioId = bloqueio.id;
  }, 120_000);

  afterAll(async () => {
    if (prisma && clienteId) {
      await prisma.bloqueioContainer.deleteMany({ where: { solicitacaoId } });
      await prisma.fatura.deleteMany({ where: { clienteId } });
      await prisma.preFatura.deleteMany({ where: { clienteId } });
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
      await prisma.cliente.deleteMany({ where: { id: clienteId } });
    }
    if (operadorId) await prisma.user.deleteMany({ where: { id: operadorId } });
    if (app) await app.close();
  });

  it('gate-out com bloqueio financeiro ativo + inadimplência → 403', async () => {
    jest.spyOn(holdRelease, 'clientePossuiInadimplenciaAtiva').mockResolvedValueOnce(true);

    const checkOutReq = request(app.getHttpServer())
      .post(`/v2/gate/check-ins/${gateInId}/check-out`)
      .set('Authorization', `Bearer ${tokenOp}`)
      .field('data', JSON.stringify({}));

    const res = await attachVistoriaFotos(checkOutReq).expect(403);
    expect(res.body.message).toMatch(/bloqueado financeiramente/i);
    expect(res.body.message).toMatch(new RegExp(bloqueioId));
  });

  it('gate-out após pagamento regularizado → sucesso + bloqueio liberado', async () => {
    jest.spyOn(holdRelease, 'clientePossuiInadimplenciaAtiva').mockResolvedValueOnce(false);

    const checkOutReq = request(app.getHttpServer())
      .post(`/v2/gate/check-ins/${gateInId}/check-out`)
      .set('Authorization', `Bearer ${tokenOp}`)
      .field('data', JSON.stringify({}));

    await attachVistoriaFotos(checkOutReq).expect(201);

    const bloqueio = await prisma.bloqueioContainer.findUnique({ where: { id: bloqueioId } });
    expect(bloqueio?.status).toBe(StatusBloqueioContainer.LIBERADO);

    const sol = await prisma.solicitacao.findUnique({ where: { id: solicitacaoId } });
    expect(sol?.status).toBe(StatusSolicitacao.CONCLUIDO);
  });
});
