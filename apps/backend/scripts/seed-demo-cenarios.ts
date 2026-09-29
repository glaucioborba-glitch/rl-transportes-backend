/**
 * Coloca unidades em vários pontos do processo para a demo.
 *
 *   cd apps/backend
 *   npx ts-node scripts/seed-demo-cenarios.ts
 *
 * Idempotente: apaga só o que este script criou (prefixo SHOW- / frota DEMO-SHOW).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  EventoGatilhoTarifa,
  FinalidadeAluguelSolicitacao,
  ModalidadeUnidadeProcesso,
  PatioStatus,
  Prisma,
  StatusAluguel,
  StatusContainer,
  StatusPagamentoFatura,
  StatusPreFatura,
  StatusSolicitacao,
  StatusSolicitacaoAluguel,
  StatusUnidadeAluguel,
  StatusUnidadeProcesso,
  TipoCaminhao,
  TipoFluxoLogistico,
  TipoOperacaoSolicitacaoIntent,
  TipoUnidade,
  TurnoAgendamento,
} from '@prisma/client';
import { diffDiasCalendario } from '../src/armazenagem-faturamento/armazenagem-billing.util';
import {
  agruparDiasPorFaixa,
  calcularArmazenagemEscalonada,
  formatarDiariasExcedentes,
} from '../src/billing-engine/faixa-diaria-calculator';
import {
  buildIso,
  DEFAULT_TENANT,
  disconnectPrisma,
  ensureOperadorGateId,
  getPrisma,
} from './seed-utils';

const MARK = 'DEMO-SHOW';
const PROTO = 'SHOW';

const FROTA = [
  { iso: buildIso('MSCU', 900201), tipo: 'DRYDC', tamanho: "20'", papel: 'disponivel' as const },
  { iso: buildIso('TEMU', 900202), tipo: 'DRYHC', tamanho: "40'", papel: 'em_uso' as const },
  { iso: buildIso('HLBU', 900203), tipo: 'DRYDC', tamanho: "20'", papel: 'devolvido' as const },
  { iso: buildIso('CMAU', 900204), tipo: 'REEFER', tamanho: "40'", papel: 'disponivel' as const },
];

const PATIO = [
  { iso: buildIso('OOLU', 900210), status: StatusSolicitacao.AGUARDANDO_GATE_IN, label: 'Autorização — aguarda Gate-In' },
  { iso: buildIso('SEGU', 900211), status: StatusSolicitacao.EM_PATIO, label: 'No pátio — ID aberto' },
  { iso: buildIso('TXGU', 900212), status: StatusSolicitacao.AGUARDANDO_GATE_OUT, label: 'Pronto para saída' },
  { iso: buildIso('FCIU', 900213), status: StatusSolicitacao.CONCLUIDO, label: 'ID encerrado — fila da Fatura' },
];

async function nextNumero(): Promise<number> {
  const p = getPrisma();
  const rows = await p.$queryRaw<Array<{ n: bigint | number }>>`
    SELECT nextval('unidade_processos_numero_seq') AS n
  `;
  return Number(rows[0]?.n ?? 0);
}

async function nextAlu(): Promise<string> {
  const p = getPrisma();
  const rows = await p.$queryRaw<Array<{ n: bigint | number }>>`
    SELECT nextval('solicitacoes_aluguel_protocolo_seq') AS n
  `;
  return `ALU-${Number(rows[0]?.n ?? 0)}`;
}

async function ensureBaias() {
  const p = getPrisma();
  for (const codigo of ['A01', 'A02', 'A03', 'B01']) {
    await p.patioPosicao.upsert({
      where: { codigoBaia: codigo },
      create: { codigoBaia: codigo, comprimento: 12, largura: 3, capacidade: 4 },
      update: {},
    });
  }
  return p.patioPosicao.findUniqueOrThrow({ where: { codigoBaia: 'A01' } });
}

type FaixaDiaria = { diaInicio: number; diaFim: number | null; valorDiaria: number };

function toNum(v: unknown): number {
  return Number(v ?? 0);
}

function cobrancaDiarias(diasEstadia: number, free: number, faixas: FaixaDiaria[]) {
  const qtd = Math.max(0, diasEstadia - free);
  const total = calcularArmazenagemEscalonada(diasEstadia, free, faixas);
  const grupos = agruparDiasPorFaixa(free + 1, diasEstadia, faixas);
  return {
    qtd,
    unit: qtd ? total / qtd : 0,
    total,
    detalhe: formatarDiariasExcedentes(grupos),
  };
}

async function loadTarifaPatio(tipo: string, tamanho: string, cheio: boolean) {
  const p = getPrisma();
  const row = await p.cadastroTabelaPrecoItem.findFirst({
    where: {
      tabela: { deletedAt: null, ativo: true, padrao: true },
      categoriaItem: 'ARMAZENAGEM',
      tipoContainerCodigo: tipo,
      containerTamanho: tamanho,
      statusContainer: cheio ? 'CHEIO' : 'VAZIO',
    },
  });
  if (!row) throw new Error(`Tabela de preços sem linha ${tipo} ${tamanho} ${cheio ? 'CHEIO' : 'VAZIO'}.`);
  const faixas = (Array.isArray(row.faixasDiaria) ? row.faixasDiaria : []) as FaixaDiaria[];
  return {
    handling: toNum(row.valorHandling),
    free: row.freeTimeDias ?? 0,
    faixas,
    energia: toNum(row.tarifaEnergiaReeferDiaria),
  };
}

async function loadTarifaAluguel(tabelaId: string, tipo: string, tamanho: string) {
  const p = getPrisma();
  const row = await p.cadastroTabelaAluguelItem.findFirst({
    where: { tabelaId, tipoContainerCodigo: tipo, containerTamanho: tamanho, deletedAt: null, ativo: true },
  });
  if (!row || toNum(row.valorDiaria) <= 0) {
    throw new Error(`Tabela de aluguel sem diária para ${tipo} ${tamanho}.`);
  }
  return {
    handling: toNum(row.valorHandling),
    diaria: toNum(row.valorDiaria),
    free: row.diasFreeTime,
  };
}

async function loadServico(codigo: string) {
  const p = getPrisma();
  const row = await p.cadastroServicoItem.findFirst({
    where: { codigo, deletedAt: null, ativo: true },
  });
  if (!row) throw new Error(`Serviço ${codigo} não encontrado na tabela.`);
  return { nome: row.nome, valor: toNum(row.valor) };
}

async function cleanup() {
  const p = getPrisma();
  const sols = await p.solicitacao.findMany({
    where: { protocolo: { startsWith: `${PROTO}-` } },
    select: { id: true },
  });
  const solIds = sols.map((s) => s.id);
  const processos = await p.unidadeProcesso.findMany({
    where: {
      OR: [
        { entradaSolicitacaoId: { in: solIds } },
        { unidadeIso: { in: [...FROTA, ...PATIO].map((u) => u.iso) } },
      ],
    },
    select: { id: true },
  });
  const procIds = processos.map((x) => x.id);
  const prefs = await p.preFatura.findMany({
    where: { OR: [{ unidadeProcessoId: { in: procIds } }, { containerIso: { in: PATIO.map((u) => u.iso) } }] },
    select: { id: true },
  });
  const prefIds = prefs.map((x) => x.id);
  const faturas = await p.fatura.findMany({
    where: { preFaturaId: { in: prefIds } },
    select: { id: true, faturaPacoteId: true },
  });

  await p.itemFaturaArmazenagem.deleteMany({ where: { preFaturaId: { in: prefIds } } });
  await p.fatura.deleteMany({ where: { id: { in: faturas.map((f) => f.id) } } });
  const pacoteIds = [...new Set(faturas.map((f) => f.faturaPacoteId).filter(Boolean))] as string[];
  if (pacoteIds.length) await p.faturaPacote.deleteMany({ where: { id: { in: pacoteIds } } });
  await p.preFatura.deleteMany({ where: { id: { in: prefIds } } });
  await p.aluguel.deleteMany({ where: { unidadeProcessoId: { in: procIds } } });
  await p.patioUnidade.deleteMany({ where: { solicitacaoId: { in: solIds } } });
  await p.gateCheckOut.deleteMany({ where: { gateIn: { solicitacaoId: { in: solIds } } } });
  await p.gateCheckIn.deleteMany({ where: { solicitacaoId: { in: solIds } } });
  await p.portaria.deleteMany({ where: { solicitacaoId: { in: solIds } } });
  await p.gate.deleteMany({ where: { solicitacaoId: { in: solIds } } });
  await p.patio.deleteMany({ where: { solicitacaoId: { in: solIds } } });
  await p.saida.deleteMany({ where: { solicitacaoId: { in: solIds } } });
  await p.unidadeProcesso.deleteMany({ where: { id: { in: procIds } } });
  if (solIds.length) await p.solicitacao.deleteMany({ where: { id: { in: solIds } } });
  await p.solicitacaoAluguel.deleteMany({ where: { createdBySub: MARK } });
  await p.cadastroUnidadeAluguel.deleteMany({ where: { observacao: MARK } });
}

async function nextProcesso(data: {
  unidadeIso: string;
  clienteId: string;
  modalidade: ModalidadeUnidadeProcesso;
  status: StatusUnidadeProcesso;
  entradaEm: Date;
  saidaEm?: Date;
  entradaSolicitacaoId?: string;
}) {
  const p = getPrisma();
  const numero = await nextNumero();
  return p.unidadeProcesso.create({
    data: {
      tenantId: DEFAULT_TENANT,
      numero,
      unidadeIso: data.unidadeIso,
      clienteId: data.clienteId,
      modalidade: data.modalidade,
      status: data.status,
      entradaEm: data.entradaEm,
      saidaEm: data.saidaEm ?? null,
      entradaSolicitacaoId: data.entradaSolicitacaoId,
    },
  });
}

async function createPatioSol(
  clienteId: string,
  operadorId: string,
  baiaId: string,
  spec: (typeof PATIO)[number],
  idx: number,
  patio: Awaited<ReturnType<typeof loadTarifaPatio>>,
  lacre: Awaited<ReturnType<typeof loadServico>>,
) {
  const p = getPrisma();
  const protocolo = `${PROTO}-${String(idx + 1).padStart(3, '0')}`;
  const mot = { nome: 'João da Silva Santos', cpf: '12345678901' };
  const placa = ['QAB1C23', 'RXY2D45', 'SCZ3E67', 'TUV4F89'][idx % 4];
  const hoje = new Date();
  const dataRef = new Date(`${hoje.toISOString().slice(0, 10)}T12:00:00.000Z`);
  const diasEstadia =
    spec.status === StatusSolicitacao.CONCLUIDO
      ? patio.free + 14
      : spec.status === StatusSolicitacao.EM_PATIO
        ? patio.free + 2
        : 3;
  const gateInAt = new Date(hoje.getTime() - (diasEstadia - 1) * 86_400_000);
  const cobranca = cobrancaDiarias(diasEstadia, patio.free, patio.faixas);

  const sol = await p.solicitacao.create({
    data: {
      tenantId: DEFAULT_TENANT,
      protocolo,
      clienteId,
      status: spec.status,
      tipoOperacao: TipoOperacaoSolicitacaoIntent.SOLICITAR_BAIXA,
      tipoFluxo: TipoFluxoLogistico.ENTREGA_BAIXA,
      transporteSolicitacao: {
        create: {
          nomeMotorista: mot.nome,
          cpfMotorista: mot.cpf,
          tipoCaminhao: TipoCaminhao.LS,
          placaCavalo: placa,
          placaCarreta01: 'DEF4G56',
        },
      },
      containersSolicitacao: {
        create: {
          unidade: spec.iso,
          booking: `BK-${protocolo}`,
          processo: `PROC-${protocolo}`,
          tamanho: "40'",
          tipo: 'DRY',
          status: StatusContainer.CHEIO,
          lacre: `LCR${9000 + idx}`,
          refrigerado: false,
          setPoint: null,
          ordem: 1,
        },
      },
      agendamentoSolicitacao: { create: { dataRef, turno: TurnoAgendamento.MANHA } },
      solicitanteContato: {
        create: { nome: mot.nome, telefone: '47999990011', email: `show.${idx}@rl.demo.test` },
      },
      unidades: { create: { numeroIso: spec.iso, tipo: TipoUnidade.IMPORT } },
    },
  });

  if (spec.status === StatusSolicitacao.AGUARDANDO_GATE_IN) {
    return { protocolo, iso: spec.iso, label: spec.label, idLabel: null as string | null };
  }

  await p.portaria.create({
    data: {
      solicitacaoId: sol.id,
      placaVeiculo: placa,
      motoristaNome: mot.nome,
      motoristaCpf: mot.cpf,
      transportadoraNome: 'Transportadora Demo',
      motoristaTelefone: '47999990011',
      statusOcr: 'validado',
    },
  });
  await p.gate.create({ data: { solicitacaoId: sol.id, ricAssinado: true } });
  await p.patio.create({
    data: { solicitacaoId: sol.id, quadra: 'QD09', fileira: `F0${idx + 1}`, posicao: 'P09' },
  });

  const gateIn = await p.gateCheckIn.create({
    data: {
      tenantId: DEFAULT_TENANT,
      solicitacaoId: sol.id,
      operadorId,
      dataHora: gateInAt,
      placaCavalo: placa,
      placaCarreta01: 'DEF4G56',
      motoristaNome: mot.nome,
      motoristaCpf: mot.cpf,
      fotosEntrada: [{ url: 'local://demo/gate-in.jpg', label: 'Entrada' }],
    },
  });

  const encerrado = spec.status === StatusSolicitacao.CONCLUIDO;
  const processo = await nextProcesso({
    unidadeIso: spec.iso,
    clienteId,
    modalidade: ModalidadeUnidadeProcesso.PATIO,
    status: encerrado ? StatusUnidadeProcesso.ENCERRADO : StatusUnidadeProcesso.ABERTO,
    entradaEm: gateInAt,
    saidaEm: encerrado ? hoje : undefined,
    entradaSolicitacaoId: sol.id,
  });

  const patioStatus =
    spec.status === StatusSolicitacao.EM_PATIO
      ? PatioStatus.ESTOCADO
      : spec.status === StatusSolicitacao.AGUARDANDO_GATE_OUT
        ? PatioStatus.AGUARDANDO_GATE_OUT
        : PatioStatus.SEPARADO;

  await p.patioUnidade.create({
    data: {
      unidadeIso: spec.iso,
      solicitacaoId: sol.id,
      gateInId: gateIn.id,
      unidadeProcessoId: processo.id,
      posicaoAtualId: encerrado ? null : baiaId,
      status: patioStatus,
      refrigerado: false,
    },
  });

  if (encerrado) {
    await p.gateCheckOut.create({
      data: {
        gateInId: gateIn.id,
        operadorId,
        dataHora: hoje,
        fotosSaida: [{ url: 'local://demo/gate-out.jpg', label: 'Saída' }],
      },
    });
    await p.saida.create({ data: { solicitacaoId: sol.id, dataHoraSaida: hoje } });
    await createFaturaFila({
      processo,
      clienteId,
      iso: spec.iso,
      gateInAt,
      dias: cobranca.qtd,
      handling: patio.handling,
      diariaTotal: cobranca.total,
      servico: lacre.valor,
      descricaoServico: lacre.nome,
      descricaoHandling: 'Handling de cheio',
      descricaoDiaria: "Diária DRY/40' / CHEIO",
      detalheDiaria: cobranca.detalhe,
    });
  } else if (spec.status === StatusSolicitacao.EM_PATIO) {
    const acum = patio.handling + cobranca.total;
    await p.preFatura.create({
      data: {
        containerIso: spec.iso,
        clienteId,
        gateInId: gateIn.id,
        unidadeProcessoId: processo.id,
        gateInAt,
        valorAcumulado: acum,
        diasCobrados: cobranca.qtd,
        status: StatusPreFatura.ABERTA,
        itens: {
          create: [
            {
              eventoGatilho: EventoGatilhoTarifa.HANDLING,
              descricao: 'Handling de cheio',
              quantidade: 1,
              valorUnitario: patio.handling,
              valorTotal: patio.handling,
            },
            {
              eventoGatilho: EventoGatilhoTarifa.DIARIA_ARMAZENAGEM,
              descricao: cobranca.detalhe
                ? `Diária DRY/40' / CHEIO — ${cobranca.detalhe}`
                : "Diária DRY/40' / CHEIO",
              quantidade: cobranca.qtd,
              valorUnitario: cobranca.unit,
              valorTotal: cobranca.total,
            },
          ],
        },
      },
    });
  }

  return { protocolo, iso: spec.iso, label: spec.label, idLabel: `ID ${processo.numero}` };
}

async function createFaturaFila(input: {
  processo: { id: string; numero: number };
  clienteId: string;
  iso: string;
  gateInAt: Date;
  dias: number;
  handling: number;
  diariaTotal: number;
  servico: number;
  descricaoServico: string;
  descricaoHandling?: string;
  descricaoDiaria?: string;
  detalheDiaria?: string;
}) {
  const p = getPrisma();
  const total = input.handling + input.diariaTotal + input.servico;
  const unitDiaria = input.dias > 0 ? input.diariaTotal / input.dias : 0;
  const tituloDiaria = input.descricaoDiaria ?? 'Diária';
  const itens: Prisma.ItemFaturaArmazenagemCreateWithoutPreFaturaInput[] = [
    {
      eventoGatilho: EventoGatilhoTarifa.HANDLING,
      descricao: input.descricaoHandling ?? 'Handling',
      quantidade: 1,
      valorUnitario: input.handling,
      valorTotal: input.handling,
    },
    {
      eventoGatilho: EventoGatilhoTarifa.DIARIA_ARMAZENAGEM,
      descricao: input.detalheDiaria ? `${tituloDiaria} — ${input.detalheDiaria}` : tituloDiaria,
      quantidade: input.dias,
      valorUnitario: unitDiaria,
      valorTotal: input.diariaTotal,
    },
  ];
  if (input.servico > 0) {
    itens.push({
      eventoGatilho: EventoGatilhoTarifa.SERVICO_ADICIONAL,
      descricao: input.descricaoServico,
      quantidade: 1,
      valorUnitario: input.servico,
      valorTotal: input.servico,
    });
  }
  const pref = await p.preFatura.create({
    data: {
      containerIso: input.iso,
      clienteId: input.clienteId,
      unidadeProcessoId: input.processo.id,
      gateInAt: input.gateInAt,
      valorAcumulado: total,
      diasCobrados: input.dias,
      status: StatusPreFatura.CONSOLIDADA,
      itens: { create: itens },
    },
  });
  await p.fatura.create({
    data: {
      tenantId: DEFAULT_TENANT,
      preFaturaId: pref.id,
      clienteId: input.clienteId,
      valorTotal: total,
      statusPagamento: StatusPagamentoFatura.PENDENTE,
    },
  });
  return total;
}

async function main() {
  const p = getPrisma();
  const costa = await p.cliente.findFirst({ where: { cpfCnpj: '27000245000175' } });
  const qa = await p.cliente.findFirst({ where: { cpfCnpj: '19131243000197' } });
  if (!costa || !qa) throw new Error('Clientes Costa Sul / QA não encontrados. Rode o seed do portal.');

  const tabela = await p.cadastroTabelaAluguel.findFirst({
    where: { deletedAt: null, ativo: true },
    orderBy: { padrao: 'desc' },
  });
  if (!tabela) throw new Error('Tabela de aluguel não encontrada.');

  const admin = await p.user.findFirst({ where: { role: 'ADMIN' } });
  const operadorId = await ensureOperadorGateId();

  console.log('[demo-show] Limpando cenário anterior…');
  await cleanup();
  const patioTarifa = await loadTarifaPatio('DRY', "40'", true);
  const lacre = await loadServico('RETIRADA_LACRE');
  const alu20 = await loadTarifaAluguel(tabela.id, 'DRYDC', "20'");
  const alu40 = await loadTarifaAluguel(tabela.id, 'DRYHC', "40'");
  const baia = await ensureBaias();

  const patioRows = [];
  for (let i = 0; i < PATIO.length; i++) {
    patioRows.push(await createPatioSol(costa.id, operadorId, baia.id, PATIO[i], i, patioTarifa, lacre));
  }

  const frotaIds: Record<string, string> = {};
  for (const u of FROTA) {
    const row = await p.cadastroUnidadeAluguel.create({
      data: {
        tenantId: DEFAULT_TENANT,
        unidadeIso: u.iso,
        tipoContainerCodigo: u.tipo,
        containerTamanho: u.tamanho,
        status: StatusUnidadeAluguel.DISPONIVEL,
        observacao: MARK,
      },
    });
    frotaIds[u.papel === 'em_uso' ? 'uso' : u.papel === 'devolvido' ? 'dev' : u.iso] = row.id;
    if (u.papel === 'disponivel') frotaIds[u.iso] = row.id;
  }

  const reservaUso = await p.solicitacaoAluguel.create({
    data: {
      tenantId: DEFAULT_TENANT,
      protocolo: await nextAlu(),
      clienteId: costa.id,
      quantidade: 1,
      finalidade: FinalidadeAluguelSolicitacao.RETIRADA_USO_EXTERNO,
      dataColeta: new Date(),
      status: StatusSolicitacaoAluguel.INICIADO,
      createdBySub: MARK,
      autorizadoPorUserId: admin?.id,
      autorizadoEm: new Date(),
    },
  });

  const iniciadoEm = new Date(Date.now() - 3 * 86_400_000);
  const procUso = await nextProcesso({
    unidadeIso: FROTA[1].iso,
    clienteId: costa.id,
    modalidade: ModalidadeUnidadeProcesso.ALUGUEL,
    status: StatusUnidadeProcesso.ABERTO,
    entradaEm: iniciadoEm,
  });
  await p.aluguel.create({
    data: {
      tenantId: DEFAULT_TENANT,
      unidadeAluguelId: frotaIds.uso,
      clienteId: costa.id,
      tabelaAluguelId: tabela.id,
      unidadeProcessoId: procUso.id,
      status: StatusAluguel.ATIVO,
      iniciadoEm,
      observacao: MARK,
      solicitacaoAluguelId: reservaUso.id,
    },
  });
  await p.cadastroUnidadeAluguel.update({
    where: { id: frotaIds.uso },
    data: { status: StatusUnidadeAluguel.ALUGADA },
  });
  await p.preFatura.create({
    data: {
      containerIso: FROTA[1].iso,
      clienteId: costa.id,
      unidadeProcessoId: procUso.id,
      gateInAt: iniciadoEm,
      valorAcumulado: alu40.handling + alu40.diaria * 3,
      diasCobrados: 3,
      status: StatusPreFatura.ABERTA,
    },
  });

  const reservaDev = await p.solicitacaoAluguel.create({
    data: {
      tenantId: DEFAULT_TENANT,
      protocolo: await nextAlu(),
      clienteId: costa.id,
      quantidade: 1,
      finalidade: FinalidadeAluguelSolicitacao.RETIRADA_USO_EXTERNO,
      status: StatusSolicitacaoAluguel.ENCERRADO,
      createdBySub: MARK,
      autorizadoPorUserId: admin?.id,
      autorizadoEm: new Date(Date.now() - 8 * 86_400_000),
    },
  });
  const fimDev = new Date(Date.now() - 1 * 86_400_000);
  const iniDev = new Date(fimDev.getTime() - 5 * 86_400_000);
  const diasAluguel = diffDiasCalendario(iniDev, fimDev);
  const procDev = await nextProcesso({
    unidadeIso: FROTA[2].iso,
    clienteId: costa.id,
    modalidade: ModalidadeUnidadeProcesso.ALUGUEL,
    status: StatusUnidadeProcesso.ENCERRADO,
    entradaEm: iniDev,
    saidaEm: fimDev,
  });
  await p.aluguel.create({
    data: {
      tenantId: DEFAULT_TENANT,
      unidadeAluguelId: frotaIds.dev,
      clienteId: costa.id,
      tabelaAluguelId: tabela.id,
      unidadeProcessoId: procDev.id,
      status: StatusAluguel.ENCERRADO,
      iniciadoEm: iniDev,
      encerradoEm: fimDev,
      observacao: MARK,
      solicitacaoAluguelId: reservaDev.id,
    },
  });
  await createFaturaFila({
    processo: procDev,
    clienteId: costa.id,
    iso: FROTA[2].iso,
    gateInAt: iniDev,
    dias: diasAluguel,
    handling: alu20.handling,
    diariaTotal: alu20.diaria * diasAluguel,
    servico: 0,
    descricaoServico: '—',
    descricaoHandling: 'Handling de aluguel',
    descricaoDiaria: 'Diária de aluguel',
    detalheDiaria: formatarDiariasExcedentes([
      { quantidade: diasAluguel, valorUnitario: alu20.diaria },
    ]),
  });

  const reservaPronta = await p.solicitacaoAluguel.create({
    data: {
      tenantId: DEFAULT_TENANT,
      protocolo: await nextAlu(),
      clienteId: costa.id,
      quantidade: 1,
      finalidade: FinalidadeAluguelSolicitacao.RETIRADA_USO_EXTERNO,
      dataColeta: new Date(Date.now() + 86_400_000),
      status: StatusSolicitacaoAluguel.APROVADO,
      createdBySub: MARK,
      autorizadoPorUserId: admin?.id,
      autorizadoEm: new Date(),
    },
  });

  const lines = [
    'RL TRANSPORTES — Cenário de demo (unidades em vários pontos)',
    '============================================================',
    'Cliente da demo: Costa Sul Armazéns Gerais LTDA',
    'CNPJ portal:     27.000.245/0001-75',
    '',
    'PÁTIO',
    ...patioRows.map((r) => `  ${r.protocolo}  ${r.iso}  ${r.idLabel ?? '—'}  ${r.label}`),
    '',
    'ALUGUEL / FROTA',
    `  ${FROTA[0].iso}  disponível na frota (pode iniciar na reserva ${reservaPronta.protocolo})`,
    `  ${FROTA[1].iso}  alugada — ${reservaUso.protocolo} — ID ${procUso.numero} aberto`,
    `  ${FROTA[2].iso}  devolvida — ${reservaDev.protocolo} — ID ${procDev.numero} na fila da Fatura`,
    `  ${FROTA[3].iso}  disponível (reefer)`,
    `  ALU-6            pedido pendente da Costa Sul (já existia)`,
    '',
    'FATURA (valores iguais às tabelas)',
    '  Financeiro → Faturas → Costa Sul',
    `    ${patioRows[3].idLabel} pátio ${PATIO[3].iso}: handling 300 + 08×30 e 06×45 (após 7 free) + RETIRADA LACRE 100`,
    `    ID ${procDev.numero} aluguel ${FROTA[2].iso}: handling e diária da tabela de aluguel`,
    '  Conferir em Cadastros → Tabelas de preços / Aluguel / Serviços.',
    '',
    'Onde abrir',
    '  Autorização pátio:  /operador/gate/controle-entrada-saida  (SHOW-001)',
    '  Saldo pátio:        /operador/gate/patio                   (SHOW-002)',
    '  Saída:              /operador/gate/controle-entrada-saida  (SHOW-003)',
    '  Aluguel reservas:   /operador/gate/alugueis',
    '  Faturas:            /financeiro/faturas',
    '  Portal Costa Sul:   /portal/login',
  ];

  const out = path.resolve(__dirname, '../../../dados-teste-demo-cenarios.txt');
  fs.writeFileSync(out, lines.join('\n'), 'utf8');
  console.log(lines.join('\n'));
  console.log(`\n[demo-show] Folha: ${out}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => disconnectPrisma());
