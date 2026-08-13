import { ConflictException, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
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
  TipoOperacaoSolicitacaoIntent,
  TurnoAgendamento,
} from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';
import { OutboxWorker } from '../src/outbox/outbox.worker';
import { BillingOutboxProcessor } from '../src/outbox/billing-outbox.processor';
import { ArmazenagemBillingService } from '../src/armazenagem-faturamento/armazenagem-billing.service';
import { calculateReeferSurcharge } from '../src/billing-engine/billing-rule-engine.util';
import { BILLING_ELIGIBLE_INTENTS } from '../src/billing-engine/billing-eligible-intents.util';
import {
  DEFAULT_VALOR_DIARIA,
  DEFAULT_VALOR_SERVICOS_EXTRAS,
} from '../src/armazenagem-faturamento/armazenagem-billing.util';
import { clienteE2eDefaults } from './helpers/e2e-cliente.factory';
import { ensureE2ePricingTable } from './helpers/e2e-pricing.factory';
import { cpfCnpjForTestUser } from './helpers/e2e-user.factory';
import { TenantContextService } from '../src/tenant/tenant-context.service';

const PLACA_CAVALO = 'ABC1D23';
const PLACA_CARRETA = 'DEF4G56';
const MOTORISTA_CPF = '52998224725';
const CONTAINER_ISO = 'MSKU9988776';

function attachVistoriaFotos(req: request.Test): request.Test {
  const buf = Buffer.from('fake-jpeg-bytes');
  return req
    .attach('foto_FRENTE', buf, { filename: 'frente.jpg', contentType: 'image/jpeg' })
    .attach('foto_TRASEIRA', buf, { filename: 'traseira.jpg', contentType: 'image/jpeg' })
    .attach('foto_LATERAL_DIREITA', buf, { filename: 'dir.jpg', contentType: 'image/jpeg' })
    .attach('foto_LATERAL_ESQUERDA', buf, { filename: 'esq.jpg', contentType: 'image/jpeg' });
}

describe('Billing Engine E2E (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  let worker: OutboxWorker;
  let billingProcessor: BillingOutboxProcessor;
  let armazenagemBilling: ArmazenagemBillingService;
  let tenantContext: TenantContextService;

  const suffix = `${Date.now()}`;
  const email = `e2e-billing-${suffix}@local.test`;
  const opEmail = `e2e-billing-op-${suffix}@local.test`;
  let clienteId: string;
  let operadorId: string;
  let tokenOp: string;
  let solicitacaoId: string;
  let gateInId: string;

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
    billingProcessor = app.get(BillingOutboxProcessor);
    armazenagemBilling = app.get(ArmazenagemBillingService);
    tenantContext = app.get(TenantContextService);

    const hash = await bcrypt.hash('BillingE2E@T3st!', 10);
    const cliente = await prisma.cliente.create({
      data: clienteE2eDefaults({
        razaoSocial: `E2E Billing Engine ${suffix}`,
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
        protocolo: `E2E-BILL-${suffix}`,
        clienteId,
        tipoOperacao: TipoOperacaoSolicitacaoIntent.SOLICITAR_COLETA,
        status: StatusSolicitacao.AGUARDANDO_GATE_IN,
        transporteSolicitacao: {
          create: {
            nomeMotorista: 'Billing E2E',
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
  }, 120_000);

  afterAll(async () => {
    if (prisma && clienteId) {
      await prisma.outboxEvent.deleteMany({ where: { aggregateType: 'FaturaArmazenagem' } });
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

  it('BILLING_ELIGIBLE_INTENTS cobre BAIXA, COLETA e intents depot', () => {
    expect(BILLING_ELIGIBLE_INTENTS).toEqual(
      expect.arrayContaining([
        TipoOperacaoSolicitacaoIntent.SOLICITAR_BAIXA,
        TipoOperacaoSolicitacaoIntent.SOLICITAR_COLETA,
        TipoOperacaoSolicitacaoIntent.SOLICITAR_IMPORTACAO_COLETA_DEPOT,
        TipoOperacaoSolicitacaoIntent.SOLICITAR_EXPORTACAO_ENTREGA_DEPOT,
      ]),
    );
  });

  it('calculateReeferSurcharge — set point -18°C aplica fator 1.5x', () => {
    expect(calculateReeferSurcharge(5, -18, 45)).toBe(337.5);
  });

  it('gate-out → pré-fatura CONSOLIDADA + fatura PROCESSANDO + outbox EMITIR_NFSE_BOLETO', async () => {
    const checkInReq = request(app.getHttpServer())
      .post(`/v2/gate/solicitacoes/${solicitacaoId}/check-in`)
      .set('Authorization', `Bearer ${tokenOp}`)
      .field(
        'data',
        JSON.stringify({
          placaCavalo: PLACA_CAVALO,
          placaCarreta01: PLACA_CARRETA,
          motoristaNome: 'Billing E2E',
          motoristaCpf: MOTORISTA_CPF,
        }),
      );
    const checkInRes = await attachVistoriaFotos(checkInReq).expect(201);

    gateInId = checkInRes.body.id as string;

    const pfOpen = await prisma.preFatura.findFirst({
      where: { gateInId, status: StatusPreFatura.ABERTA },
    });
    expect(pfOpen).toBeTruthy();

    const checkOutReq = request(app.getHttpServer())
      .post(`/v2/gate/check-ins/${gateInId}/check-out`)
      .set('Authorization', `Bearer ${tokenOp}`)
      .field('data', JSON.stringify({}));
    await attachVistoriaFotos(checkOutReq).expect(201);

    const pfConsolidada = await prisma.preFatura.findFirst({
      where: { gateInId, status: StatusPreFatura.CONSOLIDADA },
    });
    expect(pfConsolidada).toBeTruthy();

    const fatura = await prisma.fatura.findFirst({ where: { preFaturaId: pfConsolidada!.id } });
    expect(fatura?.statusPagamento).toBe(StatusPagamentoFatura.PROCESSANDO);

    const outbox = await prisma.outboxEvent.findFirst({
      where: { eventType: 'EMITIR_NFSE_BOLETO', aggregateId: fatura!.id },
    });
    expect(outbox?.status).toBe(OutboxEventStatus.PENDING);
  });

  it('double-consolidation guard — segunda consolidação lança ConflictException', async () => {
    await expect(
      prisma.$transaction(async (tx) => armazenagemBilling.consolidateOnGateOut(gateInId, new Date(), tx)),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('idempotência outbox BILLING_TRIGGERED — reprocessamento não duplica auditoria', async () => {
    const outboxId = `e2e-billing-idem-${suffix}`;
    await prisma.auditoria.create({
      data: {
        tabela: 'faturamentos',
        registroId: 'dummy',
        acao: 'INSERT',
        usuario: 'system:tos-billing',
        dadosDepois: { outboxId, valorTotal: 1, itens: 1 },
      },
    });

    await billingProcessor.processBillingTriggered(outboxId, {
      containerId: 'ctr-dummy',
      clienteId,
      agendamentoId: 'ag-dummy',
      gateInAt: new Date(),
      gateOutAt: new Date(),
      diasEstadia: 1,
      tipo: 'DRY',
      numero: `DUM${suffix}`.slice(0, 11).toUpperCase(),
      solicitacaoId: null,
    });

    const dupCount = await prisma.auditoria.count({
      where: {
        tabela: 'faturamentos',
        usuario: 'system:tos-billing',
        dadosDepois: { path: ['outboxId'], equals: outboxId },
      },
    });
    expect(dupCount).toBe(1);

    await prisma.auditoria.deleteMany({ where: { registroId: 'dummy' } });
  });

  it('tenant sem tabela de preço — CRON não crasha e retorna skippedTenants', async () => {
    const tenantSemPreco = `tenant-no-price-${suffix}`;
    await prisma.tenant.upsert({
      where: { id: tenantSemPreco },
      create: {
        id: tenantSemPreco,
        slug: tenantSemPreco,
        nome: 'Sem Preço',
        status: 'ATIVO',
      },
      update: {},
    });

    const clienteOrfao = await new Promise<{ id: string }>((resolve, reject) => {
      tenantContext.run({ tenantId: tenantSemPreco, bypassIsolation: false }, () => {
        prisma.cliente
          .create({
            data: clienteE2eDefaults({
              razaoSocial: `Orfao ${suffix}`,
              cpfCnpj: cpfCnpjForTestUser(`orphan-${suffix}@local.test`),
              email: `orphan-${suffix}@local.test`,
            }),
          })
          .then(resolve)
          .catch(reject);
      });
    });

    const gi = await prisma.gateCheckIn.create({
      data: {
        solicitacaoId,
        operadorId,
        placaCavalo: PLACA_CAVALO,
        placaCarreta01: PLACA_CARRETA,
        motoristaNome: 'Orfao',
        motoristaCpf: MOTORISTA_CPF,
        dataHora: new Date(Date.now() - 2 * 86_400_000),
      },
    });

    await prisma.preFatura.create({
      data: {
        containerIso: `ORF${suffix}`.slice(0, 11).toUpperCase(),
        clienteId: clienteOrfao.id,
        gateInId: gi.id,
        gateInAt: gi.dataHora,
        status: StatusPreFatura.ABERTA,
      },
    });

    const result = await armazenagemBilling.runDailyProvision();
    expect(result.skippedTenants).toContain(tenantSemPreco);

    await prisma.preFatura.deleteMany({ where: { clienteId: clienteOrfao.id } });
    await prisma.gateCheckIn.delete({ where: { id: gi.id } });
    await new Promise<void>((resolve, reject) => {
      tenantContext.run({ tenantId: tenantSemPreco, bypassIsolation: true }, () => {
        prisma.cliente
          .deleteMany({ where: { id: clienteOrfao.id } })
          .then(() => resolve())
          .catch(reject);
      });
    });
    await prisma.tenant.deleteMany({ where: { id: tenantSemPreco } });
  });

  it('FISCAL_INTEGRATION_ENABLED off — outbox skip graceful (fatura PENDENTE)', async () => {
    const fatura = await prisma.fatura.findFirst({ where: { clienteId } });
    expect(fatura).toBeTruthy();

    await prisma.featureFlag.upsert({
      where: { chave: 'FISCAL_INTEGRATION_ENABLED' },
      create: { chave: 'FISCAL_INTEGRATION_ENABLED', ativo: false, regras: {} },
      update: { ativo: false },
    });

    await worker.tick();

    const refreshed = await prisma.fatura.findUnique({ where: { id: fatura!.id } });
    expect(refreshed?.statusPagamento).toBe(StatusPagamentoFatura.PENDENTE);
    expect(refreshed?.processamentoErro).toMatch(/contingência/i);

    await prisma.featureFlag.upsert({
      where: { chave: 'FISCAL_INTEGRATION_ENABLED' },
      create: { chave: 'FISCAL_INTEGRATION_ENABLED', ativo: true, regras: {} },
      update: { ativo: true },
    });
  });
});
