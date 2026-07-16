import {
  PatioStatus,
  StatusContainer,
  StatusSolicitacao,
  TipoCaminhao,
  TipoFluxoLogistico,
  TipoOperacaoSolicitacaoIntent,
  TurnoAgendamento,
} from '@prisma/client';
import {
  DEFAULT_TENANT,
  ensureOperadorGateId,
  ensurePatioBaia,
  ensureTenant,
  getPrisma,
  SEED_CONTAINERS,
  SEED_PROTOCOL,
  type SeedCadastrosIds,
  type SeedPortalIds,
} from './seed-utils';

const MOTORISTAS = [
  { nome: 'João da Silva Santos', cpf: '12345678901' },
  { nome: 'Carlos Eduardo Ferreira', cpf: '98765432100' },
  { nome: 'Pedro Alves Lima', cpf: '45678912300' },
  { nome: 'Ana Paula Costa', cpf: '32165498700' },
];

const PLACAS = ['QAB1C23', 'RXY2D45', 'SCZ3E67', 'TUV4F89', 'UVW5G12', 'WXY6H34', 'XYZ7J56', 'ABC1D23'];

const BAIA_CODES = ['A01', 'A02', 'A03', 'A04', 'B01', 'B02', 'B03', 'B04'];

type GateSolicitacaoInput = {
  protocolo: string;
  clienteId: string;
  status: StatusSolicitacao;
  contIdx: number;
  motIdx: number;
  placaIdx: number;
  withGateChain: boolean;
  withCheckout?: boolean;
  patioStatus?: PatioStatus;
  createdAt?: Date;
  gateInAt?: Date;
  gateOutAt?: Date;
};

async function createGateSolicitacao(input: GateSolicitacaoInput, operadorId: string, baiaId: string) {
  const prisma = getPrisma();
  const cont = SEED_CONTAINERS[input.contIdx % SEED_CONTAINERS.length];
  const mot = MOTORISTAS[input.motIdx % MOTORISTAS.length];
  const placa = PLACAS[input.placaIdx % PLACAS.length];
  const dataRef = new Date();
  const dataRefOnly = new Date(dataRef.toISOString().slice(0, 10) + 'T12:00:00.000Z');

  const sol = await prisma.solicitacao.upsert({
    where: { protocolo: input.protocolo },
    create: {
      tenantId: DEFAULT_TENANT,
      protocolo: input.protocolo,
      clienteId: input.clienteId,
      status: input.status,
      tipoOperacao:
        input.contIdx % 2 === 0
          ? TipoOperacaoSolicitacaoIntent.SOLICITAR_BAIXA
          : TipoOperacaoSolicitacaoIntent.SOLICITAR_COLETA,
      tipoFluxo: input.contIdx % 2 === 0 ? TipoFluxoLogistico.ENTREGA_BAIXA : TipoFluxoLogistico.COLETA_CONTAINER,
      createdAt: input.createdAt ?? new Date(),
      transporteSolicitacao: {
        create: {
          nomeMotorista: mot.nome,
          cpfMotorista: mot.cpf,
          tipoCaminhao: input.contIdx % 3 === 0 ? TipoCaminhao.RODOTREM : TipoCaminhao.LS,
          placaCavalo: placa,
          placaCarreta01: PLACAS[(input.placaIdx + 1) % PLACAS.length],
        },
      },
      containersSolicitacao: {
        create: {
          unidade: cont.numero,
          booking: `BK-${input.protocolo}`,
          processo: `PROC-${input.protocolo}`,
          tamanho: cont.tamanho,
          tipo: cont.tipo,
          status: cont.situacao === 'VAZIO' ? StatusContainer.VAZIO : StatusContainer.CHEIO,
          ordem: 1,
        },
      },
      agendamentoSolicitacao: {
        create: {
          dataRef: dataRefOnly,
          turno: [TurnoAgendamento.MANHA, TurnoAgendamento.TARDE][input.contIdx % 2],
        },
      },
      solicitanteContato: {
        create: {
          nome: mot.nome,
          telefone: '47999990000',
          email: `gate.${input.protocolo.toLowerCase()}@rl.seed.test`,
        },
      },
    },
    update: {
      clienteId: input.clienteId,
      status: input.status,
    },
  });

  if (!input.withGateChain) return sol;

  await prisma.portaria.upsert({
    where: { solicitacaoId: sol.id },
    create: {
      solicitacaoId: sol.id,
      placaVeiculo: placa,
      motoristaNome: mot.nome,
      motoristaCpf: mot.cpf,
      transportadoraNome: 'Expresso Portuário SC LTDA',
      motoristaTelefone: '47999990000',
      statusOcr: 'validado',
    },
    update: {},
  });

  await prisma.gate.upsert({
    where: { solicitacaoId: sol.id },
    create: { solicitacaoId: sol.id, ricAssinado: true },
    update: { ricAssinado: true },
  });

  const patioHash = [...input.protocolo].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 10000, 0);
  const patioSlot = String(patioHash).padStart(4, '0');
  await prisma.patio.upsert({
    where: { solicitacaoId: sol.id },
    create: {
      solicitacaoId: sol.id,
      quadra: `SG${patioSlot}`,
      fileira: `F${patioSlot}`,
      posicao: `P${patioSlot}`,
    },
    update: {},
  });

  const existingGateIn = await prisma.gateCheckIn.findFirst({
    where: { solicitacaoId: sol.id },
    select: { id: true },
  });

  const gateIn =
    existingGateIn ??
    (await prisma.gateCheckIn.create({
      data: {
        tenantId: DEFAULT_TENANT,
        solicitacaoId: sol.id,
        operadorId,
        dataHora: input.gateInAt ?? new Date(Date.now() - (input.contIdx + 1) * 1_800_000),
        placaCavalo: placa,
        placaCarreta01: placa,
        motoristaNome: mot.nome,
        motoristaCpf: mot.cpf,
        fotosEntrada: [{ url: 'local://seed/gate-in.jpg', label: 'Entrada' }],
      },
    }));

  const patioStatus =
    input.patioStatus ??
    (input.status === StatusSolicitacao.AGUARDANDO_GATE_OUT
      ? PatioStatus.AGUARDANDO_GATE_OUT
      : PatioStatus.ESTOCADO);

  const existingUnidade = await prisma.patioUnidade.findFirst({
    where: { gateInId: gateIn.id, unidadeIso: cont.numero },
    select: { id: true },
  });

  if (!existingUnidade) {
    await prisma.patioUnidade.create({
      data: {
        unidadeIso: cont.numero,
        solicitacaoId: sol.id,
        gateInId: gateIn.id,
        posicaoAtualId: baiaId,
        status: patioStatus,
        refrigerado: cont.tipo === 'REEFER',
        createdAt: input.gateInAt ?? new Date(),
      },
    });
  }

  if (input.withCheckout) {
    const existingOut = await prisma.gateCheckOut.findUnique({ where: { gateInId: gateIn.id } });
    if (!existingOut) {
      await prisma.gateCheckOut.create({
        data: {
          gateInId: gateIn.id,
          operadorId,
          dataHora: input.gateOutAt ?? new Date(),
          fotosSaida: [{ url: 'local://seed/gate-out.jpg', label: 'Saída' }],
        },
      });
      await prisma.saida.upsert({
        where: { solicitacaoId: sol.id },
        create: { solicitacaoId: sol.id, dataHoraSaida: input.gateOutAt ?? new Date() },
        update: { dataHoraSaida: input.gateOutAt ?? new Date() },
      });
    }
  }

  return sol;
}

async function seedContainerCache(): Promise<void> {
  const prisma = getPrisma();
  for (const cont of SEED_CONTAINERS) {
    await prisma.cadastroContainerCache.upsert({
      where: { tenantId_numeroIso: { tenantId: DEFAULT_TENANT, numeroIso: cont.numero } },
      update: { tipo: cont.tipo, tamanho: cont.tamanho },
      create: {
        tenantId: DEFAULT_TENANT,
        numeroIso: cont.numero,
        tipo: cont.tipo,
        tamanho: cont.tamanho,
        primeiraPassagem: new Date('2026-01-15T08:30:00.000Z'),
      },
    });
  }
}

async function seedHistoricoMultipassagem(operadorId: string, baiaId: string, clienteIds: string[]): Promise<void> {
  const passagens = [
    { seq: 1, status: StatusContainer.CHEIO, entrada: new Date('2026-01-15T08:30:00.000Z'), saida: new Date('2026-01-18T16:45:00.000Z') },
    { seq: 2, status: StatusContainer.VAZIO, entrada: new Date('2026-02-10T09:15:00.000Z'), saida: new Date('2026-02-12T14:20:00.000Z') },
    { seq: 3, status: StatusContainer.CHEIO, entrada: new Date('2026-03-05T07:00:00.000Z'), saida: new Date('2026-03-08T18:10:00.000Z') },
    { seq: 4, status: StatusContainer.VAZIO, entrada: new Date('2026-04-20T10:40:00.000Z'), saida: null },
    { seq: 5, status: StatusContainer.CHEIO, entrada: new Date('2026-05-01T06:55:00.000Z'), saida: new Date('2026-05-03T11:30:00.000Z') },
  ];
  const iso = SEED_CONTAINERS[0].numero;

  for (const p of passagens) {
    const protocolo = `${SEED_PROTOCOL.gateHist}-${String(p.seq).padStart(3, '0')}`;
    const contIdx = 0;
    await createGateSolicitacao(
      {
        protocolo,
        clienteId: clienteIds[(p.seq - 1) % clienteIds.length],
        status: p.saida ? StatusSolicitacao.CONCLUIDO : StatusSolicitacao.EM_PATIO,
        contIdx,
        motIdx: p.seq - 1,
        placaIdx: p.seq - 1,
        withGateChain: true,
        withCheckout: Boolean(p.saida),
        gateInAt: p.entrada,
        gateOutAt: p.saida ?? undefined,
        createdAt: p.entrada,
      },
      operadorId,
      baiaId,
    );

    const prisma = getPrisma();
    const sol = await prisma.solicitacao.findUniqueOrThrow({ where: { protocolo } });
    await prisma.containerSolicitacao.updateMany({
      where: { solicitacaoId: sol.id },
      data: { status: p.status, unidade: iso },
    });
    await prisma.patioUnidade.updateMany({
      where: { solicitacaoId: sol.id },
      data: { unidadeIso: iso },
    });
  }
}

export async function seedGate(
  cadastrosIds: SeedCadastrosIds,
  portalIds: SeedPortalIds,
): Promise<void> {
  void cadastrosIds;
  await ensureTenant();
  const operadorId = await ensureOperadorGateId();
  const baia = await ensurePatioBaia(BAIA_CODES[0]);
  const clienteIds = portalIds.clientes.map((c) => c.id);
  if (clienteIds.length === 0) throw new Error('Nenhum cliente seed — rode seed-portal primeiro.');

  await seedContainerCache();

  // 14 autorizações pendentes (PENDENTE / EM_ANALISE)
  for (let i = 0; i < 14; i++) {
    await createGateSolicitacao(
      {
        protocolo: `${SEED_PROTOCOL.gateAuth}-${String(i + 1).padStart(3, '0')}`,
        clienteId: clienteIds[i % clienteIds.length],
        status: i < 4 ? StatusSolicitacao.EM_ANALISE : StatusSolicitacao.PENDENTE,
        contIdx: i,
        motIdx: i,
        placaIdx: i,
        withGateChain: false,
        createdAt: new Date(Date.now() - i * 3_600_000),
      },
      operadorId,
      baia.id,
    );
  }

  // 8 operações ativas (EM_PATIO, gate-in aberto)
  for (let i = 0; i < 8; i++) {
    const baiaCode = BAIA_CODES[i % BAIA_CODES.length];
    const baiaRow = await ensurePatioBaia(baiaCode);
    await createGateSolicitacao(
      {
        protocolo: `${SEED_PROTOCOL.gateOp}-${String(i + 1).padStart(3, '0')}`,
        clienteId: clienteIds[i % clienteIds.length],
        status: StatusSolicitacao.EM_PATIO,
        contIdx: i,
        motIdx: i,
        placaIdx: i + 2,
        withGateChain: true,
        withCheckout: false,
        patioStatus: PatioStatus.ESTOCADO,
        gateInAt: new Date(Date.now() - (i + 1) * 1_800_000),
      },
      operadorId,
      baiaRow.id,
    );
  }

  // 4 despachos (AGUARDANDO_GATE_OUT)
  for (let i = 0; i < 4; i++) {
    const baiaCode = BAIA_CODES[(i + 4) % BAIA_CODES.length];
    const baiaRow = await ensurePatioBaia(baiaCode);
    await createGateSolicitacao(
      {
        protocolo: `${SEED_PROTOCOL.gateDsp}-${String(i + 1).padStart(3, '0')}`,
        clienteId: clienteIds[i % clienteIds.length],
        status: StatusSolicitacao.AGUARDANDO_GATE_OUT,
        contIdx: i + 6,
        motIdx: i,
        placaIdx: i + 4,
        withGateChain: true,
        withCheckout: false,
        patioStatus: PatioStatus.AGUARDANDO_GATE_OUT,
        gateInAt: new Date(Date.now() - (i + 2) * 2_700_000),
      },
      operadorId,
      baiaRow.id,
    );
  }

  await seedHistoricoMultipassagem(operadorId, baia.id, clienteIds);
}
