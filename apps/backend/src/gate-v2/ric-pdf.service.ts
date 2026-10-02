import { PassThrough } from 'stream';
import { PDFDocument } from '../common/pdf/pdfkit.util';
import { isAssinaturaBiometria } from './assinatura-ric.util';
import {
  drawRicCabecalhoCupom,
  drawRicCamposDuasColunas,
  drawRicLinha,
  drawRicParAssinaturas,
  drawRicRodape,
  drawRicSecao,
  ricDash,
  ricFormatDateTime,
} from './ric-pdf-estilo-cupom';
import { generateRicPdfTermica80, usaRicTermica80 } from './ric-pdf-termica';

export type RICData = {
  protocolo: string;
  containerNumero: string;
  containerTipo: string;
  containerTamanho: string;
  containerSituacao: string;
  tipoOperacao: string;
  placa: string;
  placaCavalo?: string;
  placaCarreta?: string;
  placaCarreta02?: string;
  motoristaNome: string;
  motoristaCPF: string;
  transportadoraNome?: string;
  transportadoraCNPJ?: string;
  clienteNome: string;
  clienteCNPJ: string;
  vistoria: {
    fotos: Array<{
      tipo: string;
      imagem: string;
      ocrResult?: string;
      ocrMatch?: boolean;
      ocrConfianca?: number;
      ocrProvider?: string;
    }>;
    avarias: Array<{
      foto: string;
      localizacao: string;
      descricao: string;
    }>;
    dataVistoria: string;
    portariaResponsavel: string;
  };
  reconfirmacao: {
    responsavel: string;
    dataReconfirmacao: string;
    checklist: Record<string, boolean>;
  };
  assinatura: string;
  assinaturaModo?: 'DIGITAL' | 'MANUAL';
  dataAssinatura: string;
  qrToken: string;
  observacaoGate?: string;
  operadorNome?: string;
  operadorCPF?: string;
  lacre?: string;
  booking?: string;
  processo?: string;
  navio?: string;
  agendamento?: string;
  caminhao?: string;
  checkin?: string;
  unidadeProcesso?: string;
  direcao?: string;
  logoPng?: Buffer;
  empresaNome?: string;
  /** Indicativo da porta — não entra na conferência obrigatória. */
  ocrPorta?: {
    tipoIso?: string;
    rotulo?: string;
    mgwKg?: string;
    taraKg?: string;
    payloadKg?: string;
    owner?: string;
    status?: 'CONFERE' | 'DIVERGENTE' | 'SEM_CAPTURA';
    cadastroLabel?: string;
  };
};

function decodeBase64Image(dataUrl: string): Buffer | null {
  if (!dataUrl?.trim()) return null;
  try {
    const raw = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    return Buffer.from(raw, 'base64');
  } catch {
    return null;
  }
}

const FOTO_LABELS: Record<string, string> = {
  CONTAINER_OCR: 'Contêiner',
  PLACA_OCR: 'Placa cavalo',
  PLACA_CARRETA_OCR: 'Placa carreta',
  PLACA_CARRETA_02_OCR: 'Placa carreta 02',
  LACRE: 'Lacre',
  LACRE_OCR: 'Lacre',
  CABO_TOMADA: 'Cabo da tomada',
  LADO_FRONTAL: 'Frontal',
  LADO_TRASEIRO: 'Traseiro',
  LADO_DIREITO: 'Lado direito',
  LADO_ESQUERDO: 'Lado esquerdo',
};

function labelFotoTipo(tipo: string): string {
  return FOTO_LABELS[tipo] ?? tipo.replace(/_/g, ' ');
}

function isSvgPayload(dataUrl: string, buf: Buffer | null): boolean {
  if (/image\/svg/i.test(dataUrl)) return true;
  if (!buf?.length) return false;
  const head = buf.subarray(0, 80).toString('utf8').trimStart();
  return head.startsWith('<svg') || head.startsWith('<?xml');
}

/** Gera o RIC em PDF e retorna stream para pipe na resposta HTTP. */
export function generateRICPDF(
  data: RICData,
  opcoes?: { forcarCompleta?: boolean },
): PassThrough {
  if (!opcoes?.forcarCompleta && usaRicTermica80(data)) {
    return generateRicPdfTermica80(data);
  }
  const stream = new PassThrough();
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 28, bottom: 28, left: 36, right: 36 },
    info: {
      Title: `RIC - ${data.protocolo}`,
      Author: data.empresaNome || 'RL Transportes',
      Subject: 'Recibo de Intercâmbio de Contêineres',
    },
  });

  doc.pipe(stream);

  const L = 36;
  const W = 523;
  let y = 28;

  y = drawRicCabecalhoCupom(doc, data, L, y, W);
  y = drawRicCamposDuasColunas(doc, data, L, y, W, { incluirAvarias: false, inline: true });

  y = drawRicSecao(doc, 'Vistoria fotográfica', L, y, W);
  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor('#333')
    .text(
      `${ricDash(data.vistoria.portariaResponsavel)} · ${ricFormatDateTime(data.vistoria.dataVistoria)}`,
      L,
      y,
      { width: W },
    );
  y += 12;

  const fotos = data.vistoria.fotos ?? [];
  const COLS = 3;
  const GAP = 6;
  const CELL_W = (W - GAP * (COLS - 1)) / COLS;
  const IMG_H = 52;
  const CAPTION_H = 14;
  const CELL_H = IMG_H + CAPTION_H;
  const PAGE_BOTTOM = 800;

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_BOTTOM) {
      doc.addPage();
      y = 28;
    }
  };

  for (let i = 0; i < fotos.length; i++) {
    const col = i % COLS;
    if (col === 0) ensureSpace(CELL_H + 3);
    const foto = fotos[i];
    const x = L + col * (CELL_W + GAP);
    const fotoY = y;

    doc.rect(x, fotoY, CELL_W, IMG_H).strokeColor('#000').lineWidth(0.5).stroke();

    const imgBuffer = decodeBase64Image(foto.imagem ?? '');
    if (imgBuffer && !isSvgPayload(foto.imagem ?? '', imgBuffer)) {
      try {
        doc.image(imgBuffer, x + 1, fotoY + 1, {
          fit: [CELL_W - 2, IMG_H - 2],
          align: 'center',
          valign: 'center',
        });
      } catch {
        /* placeholder */
      }
    }

    doc
      .fontSize(7)
      .fillColor('#000')
      .font('Helvetica-Bold')
      .text(labelFotoTipo(foto.tipo), x, fotoY + IMG_H + 1, { width: CELL_W, ellipsis: true });

    if (foto.ocrResult) {
      doc
        .fontSize(6)
        .fillColor(foto.ocrMatch ? '#111' : '#000')
        .font('Helvetica')
        .text(`${foto.ocrResult}${foto.ocrMatch ? ' OK' : ' DIV'}`, x, fotoY + IMG_H + 9, {
          width: CELL_W,
          ellipsis: true,
        });
    }

    if (col === COLS - 1 || i === fotos.length - 1) {
      y += CELL_H + 3;
    }
  }

  y = drawRicSecao(doc, 'Avarias', L, y, W);
  if (data.vistoria.avarias?.length) {
    data.vistoria.avarias.forEach((avaria, idx) => {
      y = drawRicLinha(
        doc,
        `${idx + 1}. ${ricDash(avaria.localizacao)}`,
        ricDash(avaria.descricao),
        L,
        y,
        W,
        { inline: true },
      );
    });
  } else {
    y = drawRicLinha(doc, 'Registro', 'Nenhuma avaria', L, y, W);
  }

  const modo = data.assinaturaModo === 'MANUAL' ? 'manual' : 'digital';
  ensureSpace(90);
  if (modo === 'digital' && !isAssinaturaBiometria(data.assinatura) && data.assinatura) {
    y = drawRicSecao(doc, 'Assinaturas', L, y, W);
    const sigWidth = 240;
    const sigHeight = 46;
    const sigBuffer = decodeBase64Image(data.assinatura);
    if (sigBuffer) {
      try {
        doc.image(sigBuffer, L, y, { fit: [sigWidth, sigHeight] });
      } catch {
        /* noop */
      }
    }
    doc
      .moveTo(L, y + sigHeight)
      .lineTo(L + sigWidth, y + sigHeight)
      .strokeColor('#000')
      .lineWidth(1)
      .stroke();
    y += sigHeight + 6;
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor('#000')
      .text(ricDash(data.motoristaNome), L, y, { width: sigWidth, align: 'center' });
    y += 18;
  } else {
    y = drawRicParAssinaturas(doc, data, L, y, W, modo === 'manual' ? 'manual' : 'digital');
  }

  drawRicRodape(doc, data, L, y, W);

  doc.end();
  return stream;
}

/** Coleta o PDF em buffer (testes e fallback). */
export function generateRICPDFBuffer(data: RICData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = generateRICPDF(data);
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}
