/**
 * Exemplos para o Controle de Entrada e Saída (Gate CPO).
 * Simula o que a portaria já teria capturado  - alguns conferem, outros divergem.
 *
 * Uso: npx ts-node scripts/seed-controle-entrada-saida.ts
 */
import * as path from 'node:path';
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  Prisma,
  PrismaClient,
  StatusContainer,
  StatusSolicitacao,
  TipoCaminhao,
  TipoFluxoLogistico,
  TipoOperacaoSolicitacaoIntent,
  TurnoAgendamento,
} from '@prisma/client';
import { Pool } from 'pg';

config({ path: path.resolve(__dirname, '../../../.env') });

const PREFIX = 'SEED-CES-';
const DEFAULT_TENANT = 'default';
const MINIMAL_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL não definido (arquivo .env na raiz do monorepo).');

const pool = new Pool({ connectionString: url });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const ISO_LETTERS: Record<string, number> = {
  A: 10, B: 12, C: 13, D: 14, E: 15, F: 16, G: 17, H: 18, I: 19, J: 20, K: 21, L: 23, M: 24,
  N: 25, O: 26, P: 27, Q: 28, R: 29, S: 30, T: 31, U: 32, V: 34, W: 35, X: 36, Y: 37, Z: 38,
};

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
  return `${prefix}${serial6}${isoCheckDigit(prefix + serial6)}`.toUpperCase();
}

function fotoSvg(rotulo: string, fill: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480">
    <rect width="480" height="480" fill="${fill}"/>
    <text x="50%" y="50%" fill="#fff" font-size="28" font-family="Arial" text-anchor="middle" dominant-baseline="middle">${rotulo}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function fotosVistoria(opts: {
  ocrContainer?: string;
  ocrPlaca?: string;
  ocrPlacaCarreta?: string;
  ocrPlacaCarreta02?: string;
  ocrLacre?: string;
  ocrMatchContainer?: boolean;
  ocrMatchPlaca?: boolean;
  ocrMatchCarreta?: boolean;
  ocrMatchCarreta02?: boolean;
  ocrMatchLacre?: boolean;
  omitLacre?: boolean;
  caboTomada?: boolean;
  rodotrem?: boolean;
}): Array<{
  tipo: string;
  imagem: string;
  ocrResult?: string;
  ocrMatch?: boolean;
  ocrConfianca?: number;
  ocrProvider?: string;
}> {
  const lados: Array<[string, string, string]> = [
    ['CONTAINER_OCR', 'Contêiner OCR', '#1e3a5f'],
    ['PLACA_OCR', 'Placa cavalo', '#3f2d1c'],
    ['PLACA_CARRETA_OCR', 'Placa carreta', '#4a3728'],
    ...(opts.rodotrem ? [['PLACA_CARRETA_02_OCR', 'Placa carreta 02', '#5a4030'] as [string, string, string]] : []),
    ...(opts.omitLacre ? [] : [['LACRE_OCR', 'Lacre', '#2d3a1e'] as [string, string, string]]),
    ...(opts.caboTomada ? [['CABO_TOMADA', 'Cabo da tomada', '#1a3d4a'] as [string, string, string]] : []),
    ['LADO_FRONTAL', 'Frontal', '#1f3d2b'],
    ['LADO_TRASEIRO', 'Traseiro', '#3b1f2b'],
    ['LADO_DIREITO', 'Lado direito', '#2b2b1f'],
    ['LADO_ESQUERDO', 'Lado esquerdo', '#1f2b3b'],
  ];

  const ocrPorTipo: Record<string, { valor?: string; match?: boolean }> = {
    CONTAINER_OCR: { valor: opts.ocrContainer, match: opts.ocrMatchContainer },
    PLACA_OCR: { valor: opts.ocrPlaca, match: opts.ocrMatchPlaca },
    PLACA_CARRETA_OCR: { valor: opts.ocrPlacaCarreta, match: opts.ocrMatchCarreta },
    PLACA_CARRETA_02_OCR: { valor: opts.ocrPlacaCarreta02, match: opts.ocrMatchCarreta02 },
    LACRE_OCR: { valor: opts.ocrLacre, match: opts.ocrMatchLacre },
  };

  return lados.map(([tipo, rotulo, cor]) => {
    const base = { tipo, imagem: fotoSvg(rotulo, cor) };
    const ocr = ocrPorTipo[tipo];
    if (ocr?.valor) {
      return {
        ...base,
        ocrResult: ocr.valor,
        ocrMatch: ocr.match ?? true,
        ocrConfianca: 0.93,
        ocrProvider: 'seed',
      };
    }
    return base;
  });
}

type Caso = {
  protocolo: string;
  titulo: string;
  estado: string;
  tipoOperacao: TipoOperacaoSolicitacaoIntent;
  tipoFluxo: TipoFluxoLogistico;
  tipoCaminhao?: TipoCaminhao;
  container: string;
  tipo: string;
  tamanho: string;
  situacao: StatusContainer;
  lacre?: string;
  placa: string;
  placaCarreta: string;
  placaCarreta02?: string;
  motorista: string;
  cpf: string;
  portariaPlaca: string;
  portariaMotorista: string;
  portariaCpf: string;
  ocrContainer?: string;
  ocrPlaca?: string;
  ocrPlacaCarreta?: string;
  ocrPlacaCarreta02?: string;
  ocrLacre?: string;
  ocrMatchContainer?: boolean;
  ocrMatchPlaca?: boolean;
  ocrMatchCarreta?: boolean;
  ocrMatchCarreta02?: boolean;
  ocrMatchLacre?: boolean;
  omitLacreFoto?: boolean;
  omitCaboFoto?: boolean;
  avarias?: Array<{ foto: string; descricao: string; localizacao: string }>;
  reconfirmada?: boolean;
};

const CASOS: Caso[] = [
  {
    protocolo: `${PREFIX}OK-BAIXA`,
    titulo: 'Tudo confere  - baixa LS',
    estado: 'AGUARDANDO_RECONFIRMACAO',
    tipoOperacao: TipoOperacaoSolicitacaoIntent.SOLICITAR_BAIXA,
    tipoFluxo: TipoFluxoLogistico.ENTREGA_BAIXA,
    container: buildIso('MSCU', 770001),
    tipo: 'DRYDC',
    tamanho: '20',
    situacao: StatusContainer.CHEIO,
    lacre: 'LAC770001',
    placa: 'QAB1C23',
    placaCarreta: 'QAB2C23',
    motorista: 'João da Silva Santos',
    cpf: '52998224725',
    portariaPlaca: 'QAB1C23',
    portariaMotorista: 'João da Silva Santos',
    portariaCpf: '52998224725',
    ocrContainer: buildIso('MSCU', 770001),
    ocrPlaca: 'QAB1C23',
    ocrPlacaCarreta: 'QAB2C23',
    ocrLacre: 'LAC770001',
  },
  {
    protocolo: `${PREFIX}OK-COLETA`,
    titulo: 'Tudo confere  - coleta LS',
    estado: 'AGUARDANDO_RECONFIRMACAO',
    tipoOperacao: TipoOperacaoSolicitacaoIntent.SOLICITAR_COLETA,
    tipoFluxo: TipoFluxoLogistico.COLETA_CONTAINER,
    container: buildIso('TEMU', 770002),
    tipo: 'DRYHC',
    tamanho: '40',
    situacao: StatusContainer.VAZIO,
    placa: 'RXY2D45',
    placaCarreta: 'RXY3D45',
    motorista: 'Ana Paula Costa',
    cpf: '39053344705',
    portariaPlaca: 'RXY2D45',
    portariaMotorista: 'Ana Paula Costa',
    portariaCpf: '39053344705',
    ocrContainer: buildIso('TEMU', 770002),
    ocrPlaca: 'RXY2D45',
    ocrPlacaCarreta: 'RXY3D45',
  },
  {
    protocolo: `${PREFIX}OK-RODOTREM`,
    titulo: 'Tudo confere  - rodotrem (5 OCRs)',
    estado: 'AGUARDANDO_RECONFIRMACAO',
    tipoOperacao: TipoOperacaoSolicitacaoIntent.SOLICITAR_BAIXA,
    tipoFluxo: TipoFluxoLogistico.ENTREGA_BAIXA,
    tipoCaminhao: TipoCaminhao.RODOTREM,
    container: buildIso('OOLU', 770010),
    tipo: 'DRYHC',
    tamanho: '40',
    situacao: StatusContainer.CHEIO,
    lacre: 'LAC770010',
    placa: 'RDT1A11',
    placaCarreta: 'RDT2B22',
    placaCarreta02: 'RDT3C33',
    motorista: 'Bruno Carvalho',
    cpf: '52998224725',
    portariaPlaca: 'RDT1A11',
    portariaMotorista: 'Bruno Carvalho',
    portariaCpf: '52998224725',
    ocrContainer: buildIso('OOLU', 770010),
    ocrPlaca: 'RDT1A11',
    ocrPlacaCarreta: 'RDT2B22',
    ocrPlacaCarreta02: 'RDT3C33',
    ocrLacre: 'LAC770010',
  },
  {
    protocolo: `${PREFIX}DIV-PLACA`,
    titulo: 'Erro  - placa cavalo OCR diferente',
    estado: 'AGUARDANDO_RECONFIRMACAO',
    tipoOperacao: TipoOperacaoSolicitacaoIntent.SOLICITAR_BAIXA,
    tipoFluxo: TipoFluxoLogistico.ENTREGA_BAIXA,
    container: buildIso('HLBU', 770003),
    tipo: 'DRYHC',
    tamanho: '40',
    situacao: StatusContainer.CHEIO,
    lacre: 'LAC770003',
    placa: 'SCZ3E67',
    placaCarreta: 'SCZ4E67',
    motorista: 'Carlos Eduardo Ferreira',
    cpf: '11144477735',
    portariaPlaca: 'SCZ3E67',
    portariaMotorista: 'Carlos Eduardo Ferreira',
    portariaCpf: '11144477735',
    ocrContainer: buildIso('HLBU', 770003),
    ocrPlaca: 'ZZZ9K88',
    ocrPlacaCarreta: 'SCZ4E67',
    ocrLacre: 'LAC770003',
    ocrMatchPlaca: false,
  },
  {
    protocolo: `${PREFIX}DIV-ISO`,
    titulo: 'Erro  - contêiner OCR diferente',
    estado: 'AGUARDANDO_RECONFIRMACAO',
    tipoOperacao: TipoOperacaoSolicitacaoIntent.SOLICITAR_COLETA,
    tipoFluxo: TipoFluxoLogistico.COLETA_CONTAINER,
    container: buildIso('CMAU', 770004),
    tipo: 'DRYDC',
    tamanho: '20',
    situacao: StatusContainer.CHEIO,
    lacre: 'LAC770004',
    placa: 'TUV4F89',
    placaCarreta: 'TUV5F89',
    motorista: 'Pedro Alves Lima',
    cpf: '98765432100',
    portariaPlaca: 'TUV4F89',
    portariaMotorista: 'Pedro Alves Lima',
    portariaCpf: '98765432100',
    ocrContainer: buildIso('OOLU', 770099),
    ocrPlaca: 'TUV4F89',
    ocrPlacaCarreta: 'TUV5F89',
    ocrLacre: 'LAC770004',
    ocrMatchContainer: false,
  },
  {
    protocolo: `${PREFIX}DIV-LACRE`,
    titulo: 'Erro  - lacre OCR diferente',
    estado: 'AGUARDANDO_RECONFIRMACAO',
    tipoOperacao: TipoOperacaoSolicitacaoIntent.SOLICITAR_BAIXA,
    tipoFluxo: TipoFluxoLogistico.ENTREGA_BAIXA,
    container: buildIso('SEGU', 770005),
    tipo: 'DRYDC',
    tamanho: '20',
    situacao: StatusContainer.CHEIO,
    lacre: 'LAC770005',
    placa: 'UVW5G12',
    placaCarreta: 'UVW6G12',
    motorista: 'Marcos Antônio Rocha',
    cpf: '15350946056',
    portariaPlaca: 'UVW5G12',
    portariaMotorista: 'Marcos Antônio Rocha',
    portariaCpf: '15350946056',
    ocrContainer: buildIso('SEGU', 770005),
    ocrPlaca: 'UVW5G12',
    ocrPlacaCarreta: 'UVW6G12',
    ocrLacre: 'LAC999999',
    ocrMatchLacre: false,
  },
  {
    protocolo: `${PREFIX}AVARIA`,
    titulo: 'Dados conferem, mas há avaria na vistoria',
    estado: 'AGUARDANDO_RECONFIRMACAO',
    tipoOperacao: TipoOperacaoSolicitacaoIntent.SOLICITAR_COLETA,
    tipoFluxo: TipoFluxoLogistico.COLETA_CONTAINER,
    container: buildIso('FCIU', 770006),
    tipo: 'REEFER',
    tamanho: '40',
    situacao: StatusContainer.CHEIO,
    lacre: 'LAC770006',
    placa: 'WXY6H34',
    placaCarreta: 'WXY7H34',
    motorista: 'Luciana Mendes',
    cpf: '12345678909',
    portariaPlaca: 'WXY6H34',
    portariaMotorista: 'Luciana Mendes',
    portariaCpf: '12345678909',
    ocrContainer: buildIso('FCIU', 770006),
    ocrPlaca: 'WXY6H34',
    ocrPlacaCarreta: 'WXY7H34',
    ocrLacre: 'LAC770006',
    avarias: [
      {
        foto: MINIMAL_PNG,
        descricao: 'Amassado profundo na porta direita  - avaliar se impede operação',
        localizacao: 'Porta direita',
      },
    ],
  },
  {
    protocolo: `${PREFIX}SEM-CABO`,
    titulo: 'Reefer sem foto do cabo da tomada  - bloqueia RIC',
    estado: 'AGUARDANDO_RECONFIRMACAO',
    tipoOperacao: TipoOperacaoSolicitacaoIntent.SOLICITAR_BAIXA,
    tipoFluxo: TipoFluxoLogistico.ENTREGA_BAIXA,
    container: buildIso('RFDU', 770013),
    tipo: 'REEFER',
    tamanho: '40',
    situacao: StatusContainer.CHEIO,
    lacre: 'LAC770013',
    placa: 'CBE1N33',
    placaCarreta: 'CBE2N33',
    motorista: 'Igor Teixeira',
    cpf: '39053344705',
    portariaPlaca: 'CBE1N33',
    portariaMotorista: 'Igor Teixeira',
    portariaCpf: '39053344705',
    ocrContainer: buildIso('RFDU', 770013),
    ocrPlaca: 'CBE1N33',
    ocrPlacaCarreta: 'CBE2N33',
    ocrLacre: 'LAC770013',
    omitCaboFoto: true,
  },
  {
    protocolo: `${PREFIX}SEM-OCR`,
    titulo: 'Fotos ilegíveis / sem OCR  - conferência manual',
    estado: 'AGUARDANDO_RECONFIRMACAO',
    tipoOperacao: TipoOperacaoSolicitacaoIntent.SOLICITAR_BAIXA,
    tipoFluxo: TipoFluxoLogistico.ENTREGA_BAIXA,
    container: buildIso('TXGU', 770007),
    tipo: 'DRYHC',
    tamanho: '40',
    situacao: StatusContainer.CHEIO,
    lacre: 'LAC770007',
    placa: 'XYZ7J56',
    placaCarreta: 'XYZ8J56',
    motorista: 'Rafael Nunes',
    cpf: '52998224725',
    portariaPlaca: 'XYZ7J56',
    portariaMotorista: 'Rafael Nunes',
    portariaCpf: '52998224725',
  },
  {
    protocolo: `${PREFIX}SEM-LACRE`,
    titulo: 'Cheio sem foto do lacre  - bloqueia RIC (garantia legal)',
    estado: 'AGUARDANDO_RECONFIRMACAO',
    tipoOperacao: TipoOperacaoSolicitacaoIntent.SOLICITAR_BAIXA,
    tipoFluxo: TipoFluxoLogistico.ENTREGA_BAIXA,
    container: buildIso('HLXU', 770011),
    tipo: 'DRYDC',
    tamanho: '20',
    situacao: StatusContainer.CHEIO,
    lacre: 'LAC770011',
    placa: 'LCR1K11',
    placaCarreta: 'LCR2K11',
    motorista: 'Diego Martins',
    cpf: '39053344705',
    portariaPlaca: 'LCR1K11',
    portariaMotorista: 'Diego Martins',
    portariaCpf: '39053344705',
    ocrContainer: buildIso('HLXU', 770011),
    ocrPlaca: 'LCR1K11',
    ocrPlacaCarreta: 'LCR2K11',
    omitLacreFoto: true,
  },
  {
    protocolo: `${PREFIX}ISOTANK`,
    titulo: 'IsoTank cheio sem lacre  - exceção (lacre inacessível)',
    estado: 'AGUARDANDO_RECONFIRMACAO',
    tipoOperacao: TipoOperacaoSolicitacaoIntent.SOLICITAR_BAIXA,
    tipoFluxo: TipoFluxoLogistico.ENTREGA_BAIXA,
    container: buildIso('TCLU', 770012),
    tipo: 'ISOTANK',
    tamanho: '20',
    situacao: StatusContainer.CHEIO,
    lacre: 'LAC770012',
    placa: 'ITK1M22',
    placaCarreta: 'ITK2M22',
    motorista: 'Helena Prado',
    cpf: '11144477735',
    portariaPlaca: 'ITK1M22',
    portariaMotorista: 'Helena Prado',
    portariaCpf: '11144477735',
    ocrContainer: buildIso('TCLU', 770012),
    ocrPlaca: 'ITK1M22',
    ocrPlacaCarreta: 'ITK2M22',
    omitLacreFoto: true,
  },
  {
    protocolo: `${PREFIX}PORTARIA`,
    titulo: 'Ainda na portaria (vistoria não enviada)',
    estado: 'CHECKIN_PORTARIA',
    tipoOperacao: TipoOperacaoSolicitacaoIntent.SOLICITAR_BAIXA,
    tipoFluxo: TipoFluxoLogistico.ENTREGA_BAIXA,
    container: buildIso('YMLU', 770008),
    tipo: 'DRYDC',
    tamanho: '20',
    situacao: StatusContainer.CHEIO,
    lacre: 'LAC770008',
    placa: 'ABC1D23',
    placaCarreta: 'ABC2D23',
    motorista: 'Fernanda Souza',
    cpf: '39053344705',
    portariaPlaca: 'ABC1D23',
    portariaMotorista: 'Fernanda Souza',
    portariaCpf: '39053344705',
  },
  {
    protocolo: `${PREFIX}RIC`,
    titulo: 'Já validado  - pronto para emitir RIC',
    estado: 'RECONFIRMADA',
    tipoOperacao: TipoOperacaoSolicitacaoIntent.SOLICITAR_COLETA,
    tipoFluxo: TipoFluxoLogistico.COLETA_CONTAINER,
    container: buildIso('MSCU', 770009),
    tipo: 'DRYDC',
    tamanho: '20',
    situacao: StatusContainer.VAZIO,
    placa: 'DEF2E34',
    placaCarreta: 'DEF3E34',
    motorista: 'Paulo Henrique Dias',
    cpf: '11144477735',
    portariaPlaca: 'DEF2E34',
    portariaMotorista: 'Paulo Henrique Dias',
    portariaCpf: '11144477735',
    ocrContainer: buildIso('MSCU', 770009),
    ocrPlaca: 'DEF2E34',
    ocrPlacaCarreta: 'DEF3E34',
    reconfirmada: true,
  },
];

async function upsertCaso(clienteId: string, caso: Caso): Promise<void> {
  const hoje = new Date();
  const dataRef = new Date(`${hoje.toISOString().slice(0, 10)}T12:00:00.000Z`);
  const fotos =
    caso.estado === 'CHECKIN_PORTARIA'
      ? []
      : fotosVistoria({
          ocrContainer: caso.ocrContainer,
          ocrPlaca: caso.ocrPlaca,
          ocrPlacaCarreta: caso.ocrPlacaCarreta,
          ocrPlacaCarreta02: caso.ocrPlacaCarreta02,
          ocrLacre: caso.ocrLacre,
          ocrMatchContainer: caso.ocrMatchContainer,
          ocrMatchPlaca: caso.ocrMatchPlaca,
          ocrMatchCarreta: caso.ocrMatchCarreta,
          ocrMatchCarreta02: caso.ocrMatchCarreta02,
          ocrMatchLacre: caso.ocrMatchLacre,
          rodotrem: caso.tipoCaminhao === TipoCaminhao.RODOTREM,
          omitLacre: caso.omitLacreFoto,
          caboTomada: caso.tipo === 'REEFER' && !caso.omitCaboFoto,
        });

  const fluxo = {
    ...(fotos.length
      ? {
          vistoria: {
            fotos,
            avarias: (caso.avarias ?? []).map((a) => ({
              ...a,
              timestamp: new Date().toISOString(),
            })),
            enviadaEm: new Date().toISOString(),
          },
        }
      : {}),
    ...(caso.reconfirmada
      ? {
          reconfirmacao: {
            checklist: {
              containerConfere: true,
              tipoConfere: true,
              situacaoConfere: true,
              placaConfere: true,
              motoristaConfere: true,
              fotosOk: true,
              semAvariasCriticas: true,
            },
            reconfirmadaEm: new Date().toISOString(),
            operadorId: 'seed-ces',
          },
        }
      : {}),
  };

  const sol = await prisma.solicitacao.upsert({
    where: { protocolo: caso.protocolo },
    create: {
      tenantId: DEFAULT_TENANT,
      protocolo: caso.protocolo,
      clienteId,
      status: StatusSolicitacao.EM_EXECUCAO,
      tipoOperacao: caso.tipoOperacao,
      tipoFluxo: caso.tipoFluxo,
      operacaoFluxoEstado: caso.estado,
      operacaoFluxoJson: fluxo as Prisma.InputJsonValue,
      transporteSolicitacao: {
        create: {
          nomeMotorista: caso.motorista,
          cpfMotorista: caso.cpf,
          tipoCaminhao: caso.tipoCaminhao ?? TipoCaminhao.LS,
          placaCavalo: caso.placa,
          placaCarreta01: caso.placaCarreta,
          placaCarreta02: caso.placaCarreta02 ?? null,
        },
      },
      containersSolicitacao: {
        create: {
          unidade: caso.container,
          booking: `BK-${caso.protocolo}`,
          processo: `PROC-${caso.protocolo}`,
          tamanho: caso.tamanho,
          tipo: caso.tipo,
          status: caso.situacao,
          lacre: caso.lacre ?? null,
          refrigerado: caso.tipo === 'REEFER',
          ordem: 1,
        },
      },
      agendamentoSolicitacao: {
        create: { dataRef, turno: TurnoAgendamento.TARDE },
      },
      solicitanteContato: {
        create: {
          nome: caso.motorista,
          telefone: '47999990000',
          email: `${caso.protocolo.toLowerCase()}@rl.seed.test`,
        },
      },
    },
    update: {
      clienteId,
      status: StatusSolicitacao.EM_EXECUCAO,
      tipoOperacao: caso.tipoOperacao,
      tipoFluxo: caso.tipoFluxo,
      operacaoFluxoEstado: caso.estado,
      operacaoFluxoJson: fluxo as Prisma.InputJsonValue,
      deletedAt: null,
    },
  });

  await prisma.transporteSolicitacao.upsert({
    where: { solicitacaoId: sol.id },
    create: {
      solicitacaoId: sol.id,
      nomeMotorista: caso.motorista,
      cpfMotorista: caso.cpf,
      tipoCaminhao: caso.tipoCaminhao ?? TipoCaminhao.LS,
      placaCavalo: caso.placa,
      placaCarreta01: caso.placaCarreta,
      placaCarreta02: caso.placaCarreta02 ?? null,
    },
    update: {
      nomeMotorista: caso.motorista,
      cpfMotorista: caso.cpf,
      tipoCaminhao: caso.tipoCaminhao ?? TipoCaminhao.LS,
      placaCavalo: caso.placa,
      placaCarreta01: caso.placaCarreta,
      placaCarreta02: caso.placaCarreta02 ?? null,
    },
  });

  const existingContainer = await prisma.containerSolicitacao.findFirst({
    where: { solicitacaoId: sol.id, ordem: 1 },
  });
  if (existingContainer) {
    await prisma.containerSolicitacao.update({
      where: { id: existingContainer.id },
      data: {
        unidade: caso.container,
        tamanho: caso.tamanho,
        tipo: caso.tipo,
        status: caso.situacao,
        lacre: caso.lacre ?? null,
        refrigerado: caso.tipo === 'REEFER',
      },
    });
  }

  await prisma.portaria.upsert({
    where: { solicitacaoId: sol.id },
    create: {
      solicitacaoId: sol.id,
      placaVeiculo: caso.portariaPlaca,
      motoristaNome: caso.portariaMotorista,
      motoristaCpf: caso.portariaCpf,
      transportadoraNome: 'Expresso Portuário SC LTDA',
      motoristaTelefone: '47999990000',
      statusOcr: caso.ocrContainer || caso.ocrPlaca ? 'validado' : 'pendente',
    },
    update: {
      placaVeiculo: caso.portariaPlaca,
      motoristaNome: caso.portariaMotorista,
      motoristaCpf: caso.portariaCpf,
      transportadoraNome: 'Expresso Portuário SC LTDA',
      statusOcr: caso.ocrContainer || caso.ocrPlaca ? 'validado' : 'pendente',
    },
  });
}

async function main() {
  const cliente = await prisma.cliente.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true, razaoSocial: true, nomeFantasia: true, cpfCnpj: true },
  });
  if (!cliente) {
    throw new Error('Nenhum cliente no banco. Rode `npx prisma db seed` antes.');
  }

  for (const caso of CASOS) {
    await upsertCaso(cliente.id, caso);
  }
  await prisma.solicitacao.deleteMany({ where: { protocolo: `${PREFIX}DIV-MOTORISTA` } });

  console.log(`Cliente: ${cliente.nomeFantasia || cliente.razaoSocial} (${cliente.cpfCnpj})`);
  console.log('Fila: http://localhost:3000/operador/gate/controle-entrada-saida');
  console.log('Login Gate: CPF 15350946056 / OpsGate@QA2026');
  console.log('');
  for (const caso of CASOS) {
    console.log(`${caso.protocolo.padEnd(22)}  ${caso.titulo}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
