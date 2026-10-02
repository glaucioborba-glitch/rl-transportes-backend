import { PassThrough } from 'stream';
import type PDFKit from 'pdfkit';
import { PDFDocument } from '../common/pdf/pdfkit.util';
import type { RICData } from './ric-pdf.service';
import {
  drawRicCabecalhoCupom,
  drawRicCamposDuasColunas,
  drawRicParAssinaturas,
  drawRicRodape,
} from './ric-pdf-estilo-cupom';

const MM = 72 / 25.4;
const PAGE_W = 210 * MM;
const PAGE_H = 297 * MM;
const MARGIN = 16;
const GAP = 10;

function drawVia(
  doc: PDFKit.PDFDocument,
  data: RICData,
  top: number,
  height: number,
  viaTitulo: string,
): void {
  const L = MARGIN;
  const W = PAGE_W - MARGIN * 2;
  const inner = 8;
  const x = L + inner;
  const textW = W - inner * 2;
  const bottom = top + height;

  doc.rect(L, top, W, height).strokeColor('#000').lineWidth(0.9).stroke();

  let y = drawRicCabecalhoCupom(doc, data, x, top + inner, textW, viaTitulo, true);
  const sigReserve = 86;
  y = drawRicCamposDuasColunas(doc, data, x, y, textW, {
    incluirAvarias: true,
    limiteY: bottom - inner - sigReserve,
    inline: true,
  });
  y = Math.min(y + 4, bottom - inner - sigReserve);
  y = drawRicParAssinaturas(doc, data, x, y, textW, 'manual');
  drawRicRodape(doc, data, x, bottom - inner - 12, textW);
}

/** A4 em duas vias iguais (terminal + motorista), visual do cupom térmico. */
export function generateRicPdfA4Dupla(data: RICData): PassThrough {
  const stream = new PassThrough();
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    info: {
      Title: `RIC 2 vias ${data.protocolo}`,
      Author: data.empresaNome || 'RL Transportes',
      Subject: 'Recibo de Intercâmbio de Contêineres — duas vias A4',
    },
  });
  doc.pipe(stream);

  const viaH = (PAGE_H - MARGIN * 2 - GAP) / 2;
  const via1Top = MARGIN;
  const via2Top = MARGIN + viaH + GAP;
  const cutY = MARGIN + viaH + GAP / 2;

  drawVia(doc, data, via1Top, viaH, '1ª VIA — TERMINAL');

  doc.save();
  doc
    .moveTo(MARGIN, cutY)
    .lineTo(PAGE_W - MARGIN, cutY)
    .dash(3, { space: 2 })
    .strokeColor('#000')
    .lineWidth(0.6)
    .stroke();
  doc.undash();
  doc
    .font('Helvetica')
    .fontSize(6)
    .fillColor('#333')
    .text('recorte', MARGIN, cutY - 4, { width: PAGE_W - MARGIN * 2, align: 'center' });
  doc.restore();

  drawVia(doc, data, via2Top, viaH, '2ª VIA — MOTORISTA');

  doc.end();
  return stream;
}
