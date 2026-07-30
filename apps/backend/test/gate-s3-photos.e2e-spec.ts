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

describe('Gate V2 S3 Photos (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  let tokenOp: string;
  let solicitacaoId: string;
  let gateInId: string;
  const suffix = `${Date.now()}`;
  const email = `e2e-s3-${suffix}@local.test`;
  const opEmail = `e2e-s3-op-${suffix}@local.test`;

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
    const hash = await bcrypt.hash('S3PhotosE2E!1', 10);

    const cliente = await prisma.cliente.create({
      data: clienteE2eDefaults({
        razaoSocial: `E2E S3 Gate ${suffix}`,
        cpfCnpj: cpfCnpjForTestUser(email),
        email,
      }),
    });

    const op = await prisma.user.create({
      data: {
        cpfCnpj: cpfCnpjForTestUser(opEmail),
        email: opEmail,
        password: hash,
        role: Role.OPERADOR_GATE,
      },
    });

    const sol = await prisma.solicitacao.create({
      data: {
        protocolo: `S3-E2E-${suffix}`,
        clienteId: cliente.id,
        status: StatusSolicitacao.AGUARDANDO_GATE_IN,
        transporteSolicitacao: {
          create: {
            nomeMotorista: 'Motorista S3',
            cpfMotorista: MOTORISTA_CPF,
            placaCavalo: PLACA_CAVALO,
            placaCarreta01: PLACA_CARRETA,
            tipoCaminhao: TipoCaminhao.LS,
          },
        },
        containersSolicitacao: {
          create: [
            {
              ordem: 1,
              unidade: CONTAINER_ISO,
              booking: `BK-${suffix}`,
              processo: `PR-${suffix}`,
              tamanho: '40',
              tipo: 'DRY',
              status: StatusContainer.CHEIO,
            },
          ],
        },
        agendamentoSolicitacao: {
          create: { dataRef: new Date(), turno: TurnoAgendamento.MANHA },
        },
      },
    });
    solicitacaoId = sol.id;

    tokenOp = auth.issueTokens(op).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('check-in guarda URLs http(s) em fotos_entrada (não base64)', async () => {
    const checkInReq = request(app.getHttpServer())
      .post(`/v2/gate/solicitacoes/${solicitacaoId}/check-in`)
      .set('Authorization', `Bearer ${tokenOp}`)
      .field(
        'data',
        JSON.stringify({
          placaCavalo: PLACA_CAVALO,
          placaCarreta01: PLACA_CARRETA,
          motoristaNome: 'Motorista S3',
          motoristaCpf: MOTORISTA_CPF,
        }),
      );
    const res = await attachVistoriaFotos(checkInReq).expect(201);

    gateInId = res.body.id as string;
    expect(gateInId).toBeTruthy();

    const gi = await prisma.gateCheckIn.findUnique({ where: { id: gateInId } });
    expect(gi).toBeTruthy();
    const fotos = gi!.fotosEntrada as Record<string, string>;
    const keys = gi!.fotosEntradaKeys as Record<string, string>;
    expect(typeof fotos).toBe('object');
    expect(Object.keys(fotos).length).toBe(4);
    for (const url of Object.values(fotos)) {
      expect(url).not.toMatch(/^data:image/);
      expect(url.startsWith('http')).toBe(true);
    }
    expect(Object.keys(keys).length).toBe(4);
  });

  it('check-out guarda URLs em fotos_saida', async () => {
    await prisma.solicitacao.update({
      where: { id: solicitacaoId },
      data: { status: StatusSolicitacao.EM_PATIO },
    });

    await attachVistoriaFotos(
      request(app.getHttpServer())
        .post(`/v2/gate/check-ins/${gateInId}/check-out`)
        .set('Authorization', `Bearer ${tokenOp}`)
        .field('data', JSON.stringify({})),
    ).expect(201);

    const co = await prisma.gateCheckOut.findUnique({
      where: { gateInId },
    });
    expect(co).toBeTruthy();
    const fotos = co!.fotosSaida as Record<string, string>;
    for (const url of Object.values(fotos)) {
      expect(url).not.toMatch(/^data:image/);
      expect(url.startsWith('http')).toBe(true);
    }
  });
});
