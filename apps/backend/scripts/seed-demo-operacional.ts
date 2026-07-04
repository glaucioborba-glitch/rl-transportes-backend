/**
 * Seed operacional demo: 10 clientes PJ + ~57 solicitações em todas as fases + unidades ISO válidas.
 *
 * Uso (dev):
 *   cd apps/backend
 *   npx ts-node scripts/seed-demo-operacional.ts
 *
 * Gera também: ../../dados-teste-demo-operacional.txt
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  Prisma,
  PrismaClient,
  Role,
  StatusAgendamentoTerminal,
  StatusCarga,
  StatusContainer,
  StatusSolicitacao,
  TipoCaminhao,
  TipoCliente,
  TipoContainerTos,
  TipoFluxoLogistico,
  TipoOperacaoAgendamento,
  TipoOperacaoSolicitacaoIntent,
  TipoUnidade,
  TurnoAgendamento,
  PatioStatus,
  ContainerEventType,
  ModalidadeTransporte,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ContainerValidator = require('container-validator') as new () => { isValid: (code: string) => boolean };

config({ path: path.resolve(__dirname, '../../../.env') });

const DEFAULT_TENANT = 'default';
const DEMO_EMAIL_DOMAIN = '@rl.demo.test';
const DEMO_PASSWORD = 'Demo@PJ2026!';
const BCRYPT_ROUNDS = 12;
const TERMOS_VERSAO = 'v1.0-2026';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL não definido.');

const pool = new Pool({ connectionString: url });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const ISO_LETTERS: Record<string, number> = {
  A: 10, B: 12, C: 13, D: 14, E: 15, F: 16, G: 17, H: 18, I: 19, J: 20, K: 21, L: 23, M: 24,
  N: 25, O: 26, P: 27, Q: 28, R: 29, S: 30, T: 31, U: 32, V: 34, W: 35, X: 36, Y: 37, Z: 38,
};

function gerarCnpj(root12: string): string {
  let tamanho = 12;
  let numeros = root12.substring(0, tamanho);
  let soma = 0;
  let pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }
  let d1 = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  tamanho = 13;
  numeros = root12.substring(0, 12) + String(d1);
  soma = 0;
  pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }
  const d2 = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  return root12.substring(0, 12) + String(d1) + String(d2);
}

function gerarCpf(base9: string): string {
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(base9[i], 10) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  const d1 = String(resto);
  soma = 0;
  const cpf10 = base9 + d1;
  for (let i = 0; i < 10; i++) soma += parseInt(cpf10[i], 10) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  return base9 + d1 + String(resto);
}

function isoCheckDigit(code10: string): string {
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const ch = code10[i].toUpperCase();
    const n = /[A-Z]/.test(ch) ? ISO_LETTERS[ch] : parseInt(ch, 10);
    sum += n * 2 ** i;
  }
  let check = sum % 11;
  if (check === 10) check = 0;
  return String(check);
}

function buildIso(prefix: string, serial: number): string {
  const serial6 = String(serial).padStart(6, '0');
  const iso = `${prefix}${serial6}${isoCheckDigit(prefix + serial6)}`.toUpperCase();
  const validator = new ContainerValidator();
  if (!validator.isValid(iso)) throw new Error(`ISO inválido gerado: ${iso}`);
  return iso;
}

const ISO_PREFIXES = ['MSCU', 'TEMU', 'HLBU', 'CMAU', 'OOLU', 'TXGU', 'SEGU', 'FCIU'];

type EmpresaDemo = {
  idx: number;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  cpfPessoa: string;
  email: string;
  emailLogin: string;
  responsavel: string;
  cidade: string;
  cep: string;
  ibge: string;
};

const EMPRESAS: EmpresaDemo[] = [
  { idx: 1, razaoSocial: 'Atlântico Logística Importadora LTDA', nomeFantasia: 'Atlântico Log', cnpj: gerarCnpj('270001450001'), cpfPessoa: gerarCpf('390533401'), email: 'contato@atlantico-log.demo', emailLogin: `demo.pj01${DEMO_EMAIL_DOMAIN}`, responsavel: 'Carlos Mendes', cidade: 'Navegantes', cep: '88370700', ibge: '4211306' },
  { idx: 2, razaoSocial: 'Brasil Cargo Exportação EIRELI', nomeFantasia: 'Brasil Cargo', cnpj: gerarCnpj('270001450002'), cpfPessoa: gerarCpf('390533402'), email: 'ops@brasil-cargo.demo', emailLogin: `demo.pj02${DEMO_EMAIL_DOMAIN}`, responsavel: 'Fernanda Alves', cidade: 'Itajaí', cep: '88301001', ibge: '4208203' },
  { idx: 3, razaoSocial: 'Costa Sul Armazéns Gerais LTDA', nomeFantasia: 'Costa Sul', cnpj: gerarCnpj('270001450003'), cpfPessoa: gerarCpf('390533403'), email: 'gate@costa-sul.demo', emailLogin: `demo.pj03${DEMO_EMAIL_DOMAIN}`, responsavel: 'Ricardo Souza', cidade: 'Navegantes', cep: '88372000', ibge: '4211306' },
  { idx: 4, razaoSocial: 'Depot Container Services LTDA', nomeFantasia: 'Depot CS', cnpj: gerarCnpj('270001450004'), cpfPessoa: gerarCpf('390533404'), email: 'terminal@depot-cs.demo', emailLogin: `demo.pj04${DEMO_EMAIL_DOMAIN}`, responsavel: 'Juliana Prado', cidade: 'Itajaí', cep: '88302200', ibge: '4208203' },
  { idx: 5, razaoSocial: 'Expresso Portuário SC LTDA', nomeFantasia: 'Expresso Portuário', cnpj: gerarCnpj('270001450005'), cpfPessoa: gerarCpf('390533405'), email: 'logistica@expresso-port.demo', emailLogin: `demo.pj05${DEMO_EMAIL_DOMAIN}`, responsavel: 'Marcos Vieira', cidade: 'São Francisco do Sul', cep: '89240000', ibge: '4216206' },
  { idx: 6, razaoSocial: 'Global Trade Importação LTDA', nomeFantasia: 'Global Trade', cnpj: gerarCnpj('270001450006'), cpfPessoa: gerarCpf('390533406'), email: 'import@global-trade.demo', emailLogin: `demo.pj06${DEMO_EMAIL_DOMAIN}`, responsavel: 'Patrícia Nunes', cidade: 'Balneário Camboriú', cep: '88330000', ibge: '4202008' },
  { idx: 7, razaoSocial: 'Harbor Line Transportes LTDA', nomeFantasia: 'Harbor Line', cnpj: gerarCnpj('270001450007'), cpfPessoa: gerarCpf('390533407'), email: 'operacao@harbor-line.demo', emailLogin: `demo.pj07${DEMO_EMAIL_DOMAIN}`, responsavel: 'André Bastos', cidade: 'Itapema', cep: '88220000', ibge: '4208302' },
  { idx: 8, razaoSocial: 'Intermodal Brasil Logística LTDA', nomeFantasia: 'Intermodal BR', cnpj: gerarCnpj('270001450008'), cpfPessoa: gerarCpf('390533408'), email: 'patio@intermodal-br.demo', emailLogin: `demo.pj08${DEMO_EMAIL_DOMAIN}`, responsavel: 'Luciana Freitas', cidade: 'Joinville', cep: '89201000', ibge: '4209102' },
  { idx: 9, razaoSocial: 'Joinville Depot Terminal LTDA', nomeFantasia: 'JVT Terminal', cnpj: gerarCnpj('270001450009'), cpfPessoa: gerarCpf('390533409'), email: 'admin@jvt-terminal.demo', emailLogin: `demo.pj09${DEMO_EMAIL_DOMAIN}`, responsavel: 'Roberto Campos', cidade: 'Joinville', cep: '89204000', ibge: '4209102' },
  { idx: 10, razaoSocial: 'Kronos Shipping Agency LTDA', nomeFantasia: 'Kronos Shipping', cnpj: gerarCnpj('270001450010'), cpfPessoa: gerarCpf('390533410'), email: 'agency@kronos-ship.demo', emailLogin: `demo.pj10${DEMO_EMAIL_DOMAIN}`, responsavel: 'Simone Rocha', cidade: 'Itajaí', cep: '88303000', ibge: '4208203' },
];

const STATUS_PLAN: Array<{ status: StatusSolicitacao; count: number }> = [
  { status: StatusSolicitacao.PENDENTE, count: 8 },
  { status: StatusSolicitacao.EM_ANALISE, count: 5 },
  { status: StatusSolicitacao.APROVADO, count: 5 },
  { status: StatusSolicitacao.EM_EXECUCAO, count: 4 },
  { status: StatusSolicitacao.AGUARDANDO_GATE_IN, count: 5 },
  { status: StatusSolicitacao.EM_PATIO, count: 8 },
  { status: StatusSolicitacao.AGUARDANDO_GATE_OUT, count: 5 },
  { status: StatusSolicitacao.CONCLUIDO, count: 10 },
  { status: StatusSolicitacao.REJEITADO, count: 3 },
  { status: StatusSolicitacao.CANCELADO, count: 2 },
  { status: StatusSolicitacao.CANCELADO_CLIENTE, count: 2 },
];

const GATE_STATUSES = new Set<StatusSolicitacao>([
  StatusSolicitacao.EM_PATIO,
  StatusSolicitacao.AGUARDANDO_GATE_OUT,
  StatusSolicitacao.CONCLUIDO,
]);

const INTENTS: TipoOperacaoSolicitacaoIntent[] = [
  TipoOperacaoSolicitacaoIntent.SOLICITAR_COLETA,
  TipoOperacaoSolicitacaoIntent.SOLICITAR_BAIXA,
  TipoOperacaoSolicitacaoIntent.SOLICITAR_IMPORTACAO_COLETA_DEPOT,
  TipoOperacaoSolicitacaoIntent.SOLICITAR_EXPORTACAO_ENTREGA_DEPOT,
];

const FLUXOS: TipoFluxoLogistico[] = [
  TipoFluxoLogistico.COLETA_CONTAINER,
  TipoFluxoLogistico.ENTREGA_BAIXA,
  TipoFluxoLogistico.IMPORTACAO,
  TipoFluxoLogistico.EXPORTACAO,
];

const MOTORISTAS = [
  { nome: 'João da Silva', cpf: gerarCpf('123456789') },
  { nome: 'Maria Oliveira', cpf: gerarCpf('987654321') },
  { nome: 'Pedro Santos', cpf: gerarCpf('456789123') },
  { nome: 'Ana Costa', cpf: gerarCpf('321654987') },
];

const PLACAS = ['QAB1C23', 'RXY2D45', 'SCZ3E67', 'TUV4F89', 'UVW5G12', 'WXY6H34', 'XYZ7J56', 'ABC1D23'];

let isoSerial = 100100;

function nextIso(): string {
  const prefix = ISO_PREFIXES[isoSerial % ISO_PREFIXES.length];
  isoSerial += 1;
  return buildIso(prefix, isoSerial);
}

function fmtCnpj(d: string): string {
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function fmtCpf(d: string): string {
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

async function cleanupDemo() {
  const demoClients = await prisma.cliente.findMany({
    where: { email: { endsWith: DEMO_EMAIL_DOMAIN } },
    select: { id: true },
  });
  const clientIds = demoClients.map((c) => c.id);
  if (clientIds.length === 0) return;

  const containers = await prisma.container.findMany({
    where: { clienteId: { in: clientIds } },
    select: { id: true },
  });
  if (containers.length) {
    await prisma.containerEvent.deleteMany({ where: { containerId: { in: containers.map((c) => c.id) } } });
    await prisma.avariaRecord.deleteMany({ where: { containerId: { in: containers.map((c) => c.id) } } });
    await prisma.container.deleteMany({ where: { id: { in: containers.map((c) => c.id) } } });
  }

  await prisma.agendamentoTerminal.deleteMany({ where: { clienteId: { in: clientIds } } });
  await prisma.user.deleteMany({ where: { OR: [{ clienteId: { in: clientIds } }, { email: { endsWith: DEMO_EMAIL_DOMAIN } }] } });
  await prisma.solicitacao.deleteMany({ where: { clienteId: { in: clientIds } } });
  await prisma.tabelaTarifaria.deleteMany({ where: { clienteId: { in: clientIds } } });
  await prisma.cliente.deleteMany({ where: { id: { in: clientIds } } });
}

async function ensureOperadorId(): Promise<string> {
  const op = await prisma.user.findFirst({
    where: { role: Role.OPERADOR_PORTARIA, tenantId: DEFAULT_TENANT },
    select: { id: true },
  });
  if (!op) throw new Error('Operador portaria não encontrado — rode prisma db seed primeiro.');
  return op.id;
}

async function ensurePatioBaia(codigo: string) {
  return prisma.patioPosicao.findUniqueOrThrow({ where: { codigoBaia: codigo } });
}

async function createClienteDemo(emp: EmpresaDemo, passwordHash: string, aceiteEm: Date) {
  const cliente = await prisma.cliente.create({
    data: {
      tenantId: DEFAULT_TENANT,
      razaoSocial: emp.razaoSocial,
      nomeFantasia: emp.nomeFantasia,
      tipo: TipoCliente.PJ,
      cpfCnpj: emp.cnpj,
      email: emp.emailLogin,
      emailNfse: emp.email,
      telefone: `4733${String(100000 + emp.idx).slice(-6)}`,
      isentoIE: emp.idx % 3 === 0,
      inscricaoMunicipal: emp.idx % 2 === 0 ? String(100000 + emp.idx) : null,
      inscricaoEstadual: emp.idx % 4 === 0 ? null : String(250000000 + emp.idx),
      enderecoLogradouro: `Rua Demo Operacional ${emp.idx}`,
      enderecoNumero: String(100 + emp.idx),
      enderecoComplemento: emp.idx % 2 === 0 ? 'Sala 201' : null,
      enderecoBairro: 'Distrito Industrial',
      enderecoCidade: emp.cidade,
      enderecoUf: 'SC',
      enderecoCep: emp.cep,
      codigoMunicipioIbge: emp.ibge,
      responsavel: emp.responsavel,
      responsavelTelefone: `4799${String(800000 + emp.idx).slice(-7)}`,
      responsavelEmail: emp.email,
      diasToleranciaBloqueio: 20 + emp.idx,
      percentualMultaAtraso: new Prisma.Decimal('2.00'),
      percentualJurosAoMes: new Prisma.Decimal('1.00'),
      termosAceitosEm: aceiteEm,
      termosAceitosIp: `177.45.${emp.idx}.${10 + emp.idx}`,
      termosVersao: TERMOS_VERSAO,
    },
  });

  await prisma.user.create({
    data: {
      tenantId: DEFAULT_TENANT,
      cpfCnpj: emp.cnpj,
      email: emp.emailLogin,
      password: passwordHash,
      role: Role.ADMIN_CLIENTE,
      clienteId: cliente.id,
    },
  });

  await prisma.pessoaAutorizada.create({
    data: {
      clienteId: cliente.id,
      nome: `${emp.responsavel} (Operador)`,
      email: emp.email,
      cpf: emp.cpfPessoa,
      telefone: `4799${String(700000 + emp.idx).slice(-7)}`,
      permissoes: {
        create: {
          podeCriarSolicitacao: true,
          podeAnexarDocumentos: true,
          podeAgendarTurno: true,
          podeVisualizarFinanceiro: true,
          podeAprovarOS: true,
          podeVerOS: true,
          podeAlterarDadosGate: true,
          podeGerarPDF: true,
          podeGerenciarPessoas: true,
        },
      },
    },
  });

  await prisma.tabelaTarifaria.create({
    data: {
      clienteId: cliente.id,
      freeTimeDias: 5 + (emp.idx % 3),
      valorDiaria: new Prisma.Decimal(String(75 + emp.idx * 2)),
      valorServicosExtras: new Prisma.Decimal(String(100 + emp.idx * 5)),
    },
  });

  return cliente;
}

type SolCreated = { protocolo: string; status: StatusSolicitacao; iso: string; clienteIdx: number };

async function createSolicitacaoDemo(
  clienteId: string,
  clienteIdx: number,
  solIdx: number,
  status: StatusSolicitacao,
  operadorId: string,
  baiaCodes: string[],
): Promise<SolCreated> {
  const protocolo = `DEMO-RL-2026-${String(solIdx).padStart(3, '0')}`;
  const iso = nextIso();
  const mot = MOTORISTAS[solIdx % MOTORISTAS.length];
  const placaCavalo = PLACAS[solIdx % PLACAS.length];
  const placaCarreta = PLACAS[(solIdx + 3) % PLACAS.length];
  const intent = INTENTS[solIdx % INTENTS.length];
  const fluxo = FLUXOS[solIdx % FLUXOS.length];
  const turno = solIdx % 2 === 0 ? TurnoAgendamento.MANHA : TurnoAgendamento.TARDE;
  const dataRef = new Date();
  dataRef.setDate(dataRef.getDate() + (solIdx % 14));
  const dataRefOnly = new Date(dataRef.toISOString().slice(0, 10) + 'T12:00:00.000Z');

  const sol = await prisma.solicitacao.create({
    data: {
      tenantId: DEFAULT_TENANT,
      protocolo,
      clienteId,
      status,
      tipoOperacao: intent,
      tipoFluxo: fluxo,
      versaoCredencial: 1 + (solIdx % 3),
      transporteSolicitacao: {
        create: {
          nomeMotorista: mot.nome,
          cpfMotorista: mot.cpf,
          tipoCaminhao: solIdx % 5 === 0 ? TipoCaminhao.RODOTREM : TipoCaminhao.LS,
          placaCavalo,
          placaCarreta01: placaCarreta,
          placaCarreta02: solIdx % 5 === 0 ? PLACAS[(solIdx + 5) % PLACAS.length] : null,
        },
      },
      containersSolicitacao: {
        create: {
          unidade: iso,
          booking: `BK-DEMO-${solIdx}`,
          processo: `PROC-${2026000 + solIdx}`,
          tamanho: solIdx % 3 === 0 ? '40HC' : '20DC',
          tipo: solIdx % 4 === 0 ? 'REEFER' : 'DRY',
          status: solIdx % 2 === 0 ? StatusContainer.CHEIO : StatusContainer.VAZIO,
          lacre: `LCR${10000 + solIdx}`,
          refrigerado: solIdx % 4 === 0,
          setPoint: solIdx % 4 === 0 ? -18 : null,
          ordem: 1,
        },
      },
      agendamentoSolicitacao: {
        create: {
          dataRef: dataRefOnly,
          turno,
          atendimentoEspecial: solIdx % 7 === 0,
          atendimentoEspecialTexto: solIdx % 7 === 0 ? 'Carga sensível — prioridade gate.' : null,
        },
      },
      solicitanteContato: {
        create: {
          nome: mot.nome,
          telefone: `4799${String(600000 + solIdx).slice(-7)}`,
          email: `solicitante.${solIdx}${DEMO_EMAIL_DOMAIN}`,
        },
      },
      unidades: {
        create: {
          numeroIso: iso,
          tipo: solIdx % 2 === 0 ? TipoUnidade.IMPORT : TipoUnidade.EXPORT,
        },
      },
    },
  });

  if (GATE_STATUSES.has(status)) {
    await prisma.portaria.create({
      data: {
        solicitacaoId: sol.id,
        placaVeiculo: placaCavalo,
        motoristaNome: mot.nome,
        motoristaCpf: mot.cpf,
        transportadoraNome: `Transportadora Demo ${clienteIdx}`,
        motoristaTelefone: `4799${String(600000 + solIdx).slice(-7)}`,
        statusOcr: 'validado',
      },
    });

    await prisma.gate.create({ data: { solicitacaoId: sol.id, ricAssinado: true } });

    const baiaCode = baiaCodes[solIdx % baiaCodes.length];
    const baia = await ensurePatioBaia(baiaCode);
    const q = Math.floor(solIdx / 8) + 1;
    const f = (solIdx % 8) + 1;
    const p = (solIdx % 4) + 1;

    await prisma.patio.create({
      data: {
        solicitacaoId: sol.id,
        quadra: `QD${String(q).padStart(2, '0')}`,
        fileira: `F${String(f).padStart(2, '0')}`,
        posicao: `P${String(p).padStart(2, '0')}`,
      },
    });

    const gateIn = await prisma.gateCheckIn.create({
      data: {
        tenantId: DEFAULT_TENANT,
        solicitacaoId: sol.id,
        operadorId,
        placaCavalo,
        placaCarreta01: placaCarreta,
        motoristaNome: mot.nome,
        motoristaCpf: mot.cpf,
        fotosEntrada: [{ url: 'local://demo/gate-in.jpg', label: 'Entrada' }],
      },
    });

    const patioStatus =
      status === StatusSolicitacao.EM_PATIO
        ? PatioStatus.ESTOCADO
        : status === StatusSolicitacao.AGUARDANDO_GATE_OUT
          ? PatioStatus.AGUARDANDO_GATE_OUT
          : PatioStatus.SEPARADO;

    await prisma.patioUnidade.create({
      data: {
        unidadeIso: iso,
        solicitacaoId: sol.id,
        gateInId: gateIn.id,
        posicaoAtualId: baia.id,
        status: patioStatus,
        refrigerado: solIdx % 4 === 0,
      },
    });

    if (status === StatusSolicitacao.CONCLUIDO) {
      await prisma.gateCheckOut.create({
        data: {
          gateInId: gateIn.id,
          operadorId,
          fotosSaida: [{ url: 'local://demo/gate-out.jpg', label: 'Saída' }],
        },
      });
      await prisma.saida.create({
        data: {
          solicitacaoId: sol.id,
          dataHoraSaida: new Date(),
        },
      });
    }
  }

  return { protocolo, status, iso, clienteIdx };
}

async function createAgendamentosEstoque(clienteId: string, clienteIdx: number, count: number) {
  for (let i = 0; i < count; i++) {
    const iso = nextIso();
    const dataRef = new Date();
    dataRef.setDate(dataRef.getDate() + i);
    const dataRefOnly = new Date(dataRef.toISOString().slice(0, 10) + 'T12:00:00.000Z');
    const ag = await prisma.agendamentoTerminal.create({
      data: {
        tenantId: DEFAULT_TENANT,
        clienteId,
        numeroIso: iso,
        dataRef: dataRefOnly,
        turno: i % 2 === 0 ? TurnoAgendamento.MANHA : TurnoAgendamento.TARDE,
        status: i % 3 === 0 ? StatusAgendamentoTerminal.CONFIRMADO : StatusAgendamentoTerminal.PENDENTE,
        tipoOperacao: i % 2 === 0 ? TipoOperacaoAgendamento.GATE_IN : TipoOperacaoAgendamento.GATE_OUT,
        modalidadeTransporte: ModalidadeTransporte.FROTA_CLIENTE,
        statusCarga: i % 2 === 0 ? StatusCarga.CHEIO : StatusCarga.VAZIO,
        localOrigem: `Porto Demo ${clienteIdx}`,
        localDestino: `Terminal RL — Baia ${String.fromCharCode(65 + (i % 4))}${(i % 4) + 1}`,
      },
    });

    const container = await prisma.container.create({
      data: {
        numero: iso,
        tipo: i % 3 === 0 ? TipoContainerTos.REEFER : TipoContainerTos.DRY,
        clienteId,
        agendamentoId: ag.id,
      },
    });

    const events: ContainerEventType[] = [
      ContainerEventType.SCHEDULED,
      ContainerEventType.GATE_IN_COMPLETED,
      ContainerEventType.YARD_ALLOCATED,
    ];
    if (i % 2 === 1) events.push(ContainerEventType.GATE_OUT_COMPLETED);

    for (const [ord, eventType] of events.entries()) {
      await prisma.containerEvent.create({
        data: {
          containerId: container.id,
          eventType,
          payload: { demo: true, ordem: ord, clienteIdx },
        },
      });
    }
  }
}

function writeCredentialsFile(solicitacoes: SolCreated[]) {
  const lines: string[] = [
    'RL TRANSPORTES — Dados de teste operacional (Demo PJ + Solicitações)',
    '====================================================================',
    'Gerado por: apps/backend/scripts/seed-demo-operacional.ts',
    'Ambiente: desenvolvimento local APENAS — não usar em produção.',
    '',
    'Pré-requisito: seed base + migrações aplicadas',
    '  cd apps/backend && npx prisma db seed',
    '  npx ts-node scripts/seed-demo-operacional.ts',
    '',
    'Portal login: http://localhost:3000/portal/login',
    'API:          http://localhost:3001',
    '',
    'Senha comum (todos os 10 PJ): ' + DEMO_PASSWORD,
    'Fluxo PJ: login com CNPJ → confirmação com CPF da pessoa autorizada.',
    '',
    '======================================================================',
    'EMPRESAS (10 PJ) — CNPJ login | CPF pessoa | e-mail portal',
    '======================================================================',
  ];

  for (const emp of EMPRESAS) {
    lines.push('');
    lines.push(`--- PJ ${String(emp.idx).padStart(2, '0')}: ${emp.nomeFantasia} ---`);
    lines.push(`Razão social:     ${emp.razaoSocial}`);
    lines.push(`CNPJ (login):     ${emp.cnpj}  (${fmtCnpj(emp.cnpj)})`);
    lines.push(`CPF (2º passo):   ${emp.cpfPessoa}  (${fmtCpf(emp.cpfPessoa)})`);
    lines.push(`E-mail portal:    ${emp.emailLogin}`);
    lines.push(`E-mail NFS-e:     ${emp.email}`);
    lines.push(`Responsável:      ${emp.responsavel}`);
    lines.push(`Cidade/UF:        ${emp.cidade}/SC`);
    lines.push(`Termos aceitos:   ${TERMOS_VERSAO} (IP demo 177.45.${emp.idx}.${10 + emp.idx})`);
  }

  lines.push('');
  lines.push('======================================================================');
  lines.push(`SOLICITAÇÕES (${solicitacoes.length} unidades — todas as fases operacionais)`);
  lines.push('======================================================================');
  lines.push('Protocolo              | Status                  | ISO        | Cliente');
  lines.push('-----------------------|-------------------------|------------|--------');

  const statusPad = (s: string) => s.padEnd(23);
  for (const s of solicitacoes) {
    lines.push(
      `${s.protocolo.padEnd(22)} | ${statusPad(s.status)} | ${s.iso} | PJ${String(s.clienteIdx).padStart(2, '0')}`,
    );
  }

  const byStatus = solicitacoes.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {});
  lines.push('');
  lines.push('Resumo por status:');
  for (const [st, n] of Object.entries(byStatus).sort()) {
    lines.push(`  ${st}: ${n}`);
  }

  lines.push('');
  lines.push('Agendamentos terminal + containers TOS: 3 por cliente (30 slots depot).');
  lines.push('Unidades ISO: validadas ISO 6346 (container-validator).');
  lines.push('');

  const outPath = path.resolve(__dirname, '../../../dados-teste-demo-operacional.txt');
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  return outPath;
}

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PROD_SEED !== '1') {
    console.error('[demo-seed] Bloqueado em produção.');
    process.exit(1);
  }

  console.log('[demo-seed] Limpando dados demo anteriores…');
  await cleanupDemo();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS);
  const operadorId = await ensureOperadorId();
  const baiaCodes = ['A01', 'A02', 'A03', 'A04', 'B01', 'B02', 'B03', 'B04'];
  const aceiteBase = new Date('2026-06-09T14:00:00.000Z');

  const clientes: { id: string; idx: number }[] = [];
  for (const emp of EMPRESAS) {
    const aceiteEm = new Date(aceiteBase.getTime() + emp.idx * 3_600_000);
    const c = await createClienteDemo(emp, passwordHash, aceiteEm);
    clientes.push({ id: c.id, idx: emp.idx });
    console.log(`[demo-seed] Cliente PJ${String(emp.idx).padStart(2, '0')} OK — ${emp.nomeFantasia}`);
  }

  const solicitacoes: SolCreated[] = [];
  let solIdx = 1;
  let clienteRot = 0;

  for (const { status, count } of STATUS_PLAN) {
    for (let i = 0; i < count; i++) {
      const { id: clienteId, idx: clienteIdx } = clientes[clienteRot % clientes.length];
      clienteRot++;
      const created = await createSolicitacaoDemo(clienteId, clienteIdx, solIdx, status, operadorId, baiaCodes);
      solicitacoes.push(created);
      solIdx++;
    }
  }

  for (const { id, idx } of clientes) {
    await createAgendamentosEstoque(id, idx, 3);
  }

  const outFile = writeCredentialsFile(solicitacoes);
  console.log('');
  console.log(`[demo-seed] Concluído: ${EMPRESAS.length} PJ, ${solicitacoes.length} solicitações, ${isoSerial - 100100} ISOs únicos.`);
  console.log(`[demo-seed] Credenciais: ${outFile}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
