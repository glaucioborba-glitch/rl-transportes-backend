import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import {
  Role,
  StatusContainer,
  StatusSolicitacao,
  TipoCaminhao,
  TurnoAgendamento,
} from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';
import { clienteE2eDefaults } from './helpers/e2e-cliente.factory';
import { cpfCnpjForTestUser } from './helpers/e2e-user.factory';

const MINIMAL_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const PLACA_CAVALO = 'GAT1E23';
const PLACA_CARRETA = 'GAT4E56';
const MOTORISTA_CPF = '52998224725';
const CONTAINER_ISO = 'MSCU1001137';

/**
 * Fluxo operacional Gate (portaria → vistoria → reconfirmação → RIC → operação).
 * Substitui o script manual `scripts/test-operacao-fluxo-e2e.ts` no CI.
 */
describe('Gate operacao-fluxo FSM (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;

  const suffix = `${Date.now()}`;
  const emailCliente = `e2e-fluxo-cl-${suffix}@local.test`;
  const emailAdmin = `e2e-fluxo-ad-${suffix}@local.test`;
  const emailPort = `e2e-fluxo-pt-${suffix}@local.test`;
  const emailGate = `e2e-fluxo-gt-${suffix}@local.test`;
  const password = 'FluxoE2E@T3st!';

  let clienteId: string;
  let solicitacaoId: string;
  let protocolo: string;
  let tokenAdmin: string;
  let tokenPort: string;
  let tokenGate: string;
  const userIds: string[] = [];

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

    const cliente = await prisma.cliente.create({
      data: clienteE2eDefaults({
        razaoSocial: `E2E Fluxo Gate ${suffix}`,
        cpfCnpj: cpfCnpjForTestUser(emailCliente),
        email: emailCliente,
        emailNfse: emailCliente,
      }),
    });
    clienteId = cliente.id;

    const [admin, port, gate] = await Promise.all([
      prisma.user.create({
        data: {
          cpfCnpj: cpfCnpjForTestUser(emailAdmin, 'admin'),
          email: emailAdmin,
          password: hash,
          role: Role.ADMIN,
        },
      }),
      prisma.user.create({
        data: {
          cpfCnpj: cpfCnpjForTestUser(emailPort, 'port'),
          email: emailPort,
          password: hash,
          role: Role.OPERADOR_PORTARIA,
        },
      }),
      prisma.user.create({
        data: {
          cpfCnpj: cpfCnpjForTestUser(emailGate, 'gate'),
          email: emailGate,
          password: hash,
          role: Role.OPERADOR_GATE,
        },
      }),
    ]);
    userIds.push(admin.id, port.id, gate.id);
    tokenAdmin = auth.issueTokens(admin).accessToken;
    tokenPort = auth.issueTokens(port).accessToken;
    tokenGate = auth.issueTokens(gate).accessToken;

    const sol = await prisma.solicitacao.create({
      data: {
        protocolo: `E2E-FLUXO-${suffix}`,
        clienteId,
        status: StatusSolicitacao.PENDENTE,
        transporteSolicitacao: {
          create: {
            nomeMotorista: 'Motorista Fluxo E2E',
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
        anexosSolicitacao: {
          create: {
            filename: 'cte-e2e.pdf',
            mimeType: 'application/pdf',
            size: 1024,
            urlS3: 'local://seed/e2e-cte.pdf',
            expiresAt: new Date(Date.now() + 7 * 86400000),
          },
        },
      },
    });
    solicitacaoId = sol.id;
    protocolo = sol.protocolo;
  }, 120_000);

  afterAll(async () => {
    if (prisma && solicitacaoId) {
      await prisma.solicitacaoAnexo.deleteMany({ where: { solicitacaoId } });
      await prisma.solicitacao.deleteMany({ where: { id: solicitacaoId } });
    }
    if (prisma && clienteId) {
      await prisma.cliente.deleteMany({ where: { id: clienteId } });
    }
    if (prisma && userIds.length) {
      await prisma.auditoria.deleteMany({ where: { usuario: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    if (app) await app.close();
  });

  it('percorre FSM completo: aprovar → check-in → vistoria → RIC → concluir', async () => {
    const approved = await request(app.getHttpServer())
      .post(`/v2/solicitacoes/${solicitacaoId}/aprovar`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(201);

    expect(approved.body.qrToken).toBeTruthy();
    expect(approved.body.operacaoFluxoEstado).toBe('AGUARDANDO_CHEGADA');

    const op0 = await request(app.getHttpServer())
      .get(`/v2/gate/operacoes/${protocolo}`)
      .set('Authorization', `Bearer ${tokenPort}`)
      .expect(200);
    expect(op0.body.state).toBe('AGUARDANDO_CHEGADA');

    const busca = await request(app.getHttpServer())
      .get(`/v2/gate/aguardando-chegada?search=${encodeURIComponent(protocolo)}`)
      .set('Authorization', `Bearer ${tokenPort}`)
      .expect(200);
    expect(busca.body.items.some((i: { protocolo: string }) => i.protocolo === protocolo)).toBe(true);

    const op1 = await request(app.getHttpServer())
      .post(`/v2/gate/operacoes/${protocolo}/checkin`)
      .set('Authorization', `Bearer ${tokenPort}`)
      .expect(201);
    expect(op1.body.state).toBe('CHECKIN_PORTARIA');

    const fotos = [
      'CONTAINER_OCR',
      'PLACA_OCR',
      'LADO_FRONTAL',
      'LADO_TRASEIRO',
      'LADO_DIREITO',
      'LADO_ESQUERDO',
    ].map((tipo) => ({
      tipo,
      imagem: MINIMAL_PNG,
      ...(tipo.includes('OCR') ? { ocrResult: 'TEST', ocrMatch: true } : {}),
    }));

    const op2 = await request(app.getHttpServer())
      .post(`/v2/gate/operacoes/${protocolo}/vistoria`)
      .set('Authorization', `Bearer ${tokenPort}`)
      .send({ fotos, avarias: [] })
      .expect(201);
    expect(op2.body.state).toBe('AGUARDANDO_RECONFIRMACAO');

    const checklist = {
      containerConfere: true,
      tipoConfere: true,
      situacaoConfere: true,
      placaConfere: true,
      motoristaConfere: true,
      fotosOk: true,
      semAvariasCriticas: true,
    };

    const op3 = await request(app.getHttpServer())
      .post(`/v2/gate/operacoes/${protocolo}/reconfirmar`)
      .set('Authorization', `Bearer ${tokenGate}`)
      .send({ checklist })
      .expect(201);
    expect(op3.body.state).toBe('RECONFIRMADA');

    await request(app.getHttpServer())
      .post(`/v2/gate/operacoes/${protocolo}/assinatura`)
      .set('Authorization', `Bearer ${tokenGate}`)
      .send({ assinatura: MINIMAL_PNG })
      .expect(201);

    const ric = await request(app.getHttpServer())
      .post(`/v2/gate/operacoes/${protocolo}/ric-pdf`)
      .set('Authorization', `Bearer ${tokenGate}`)
      .expect(201);
    expect(ric.headers['content-type']).toMatch(/application\/pdf/);
    expect(Buffer.isBuffer(ric.body) ? ric.body.subarray(0, 4).toString() : '').toBe('%PDF');

    const op4 = await request(app.getHttpServer())
      .post(`/v2/gate/operacoes/${protocolo}/liberar-operacao`)
      .set('Authorization', `Bearer ${tokenGate}`)
      .expect(201);
    expect(op4.body.state).toBe('LIBERADA_OPERACAO');

    const op5 = await request(app.getHttpServer())
      .post(`/v2/gate/operacoes/${protocolo}/iniciar`)
      .set('Authorization', `Bearer ${tokenGate}`)
      .send({})
      .expect(201);
    expect(op5.body.state).toBe('EM_OPERACAO');

    const op6 = await request(app.getHttpServer())
      .post(`/v2/gate/operacoes/${protocolo}/concluir`)
      .set('Authorization', `Bearer ${tokenGate}`)
      .expect(201);
    expect(op6.body.state).toBe('CONCLUIDA');

    const reconfCount = await request(app.getHttpServer())
      .get('/v2/gate/reconfirmacoes/count')
      .set('Authorization', `Bearer ${tokenGate}`)
      .expect(200);
    expect(typeof reconfCount.body.count).toBe('number');
  }, 120_000);
});
