import { PassThrough } from 'stream';
import { PDFDocument } from '../common/pdf/pdfkit.util';
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

function formatDate(isoDate: string): string {
  if (!isoDate) return '—';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString('pt-BR');
}

function formatDateTime(isoDate: string): string {
  if (!isoDate) return '—';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleString('pt-BR');
}

function formatCPFForPDF(cpf: string): string {
  if (!cpf) return '—';
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return cpf;
  return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function formatCNPJForPDF(cnpj: string): string {
  if (!cnpj) return '—';
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14) return cnpj;
  return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

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

function isSituacaoCheio(situacao?: string): boolean {
  return (situacao ?? '').trim().toUpperCase() === 'CHEIO';
}

function isSvgPayload(dataUrl: string, buf: Buffer | null): boolean {
  if (/image\/svg/i.test(dataUrl)) return true;
  if (!buf?.length) return false;
  const head = buf.subarray(0, 80).toString('utf8').trimStart();
  return head.startsWith('<svg') || head.startsWith('<?xml');
}

/** Gera o RIC em PDF e retorna stream para pipe na resposta HTTP. */
export function generateRICPDF(data: RICData): PassThrough {
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

  const empresaNome = (data.empresaNome || 'RL TRANSPORTES').toUpperCase();
  if (data.logoPng?.length) {
    try {
      doc.image(data.logoPng, L + W / 2 - 50, 16, { fit: [100, 22], align: 'center' });
    } catch {
      doc.fontSize(7).fillColor('#9E9E9E').text(empresaNome, L, 24, { align: 'center', width: W });
    }
  } else {
    doc.fontSize(7).fillColor('#9E9E9E').text(empresaNome, L, 24, { align: 'center', width: W });
  }
  const dash = (v?: string) => (v?.trim() ? v.trim() : '—');
  const placaCavalo = data.placaCavalo?.trim() || data.placa || '—';
  const placaCarreta = data.placaCarreta?.trim() || '—';
  const placaCarreta02 = data.placaCarreta02?.trim();

  doc
    .fontSize(11)
    .fillColor('#1A1A1A')
    .font('Helvetica-Bold')
    .text('RECIBO DE INTERCÂMBIO DE CONTÊINERES (RIC)', L, 42, { width: 278, ellipsis: true });
  doc.fontSize(8).fillColor('#9E9E9E').font('Helvetica').text('ID:', L + 286, 44);
  doc
    .fontSize(9)
    .fillColor('#1A1A1A')
    .font('Helvetica-Bold')
    .text(dash(data.unidadeProcesso), L + 302, 43, { width: 72, ellipsis: true });
  doc.fontSize(8).fillColor('#9E9E9E').font('Helvetica').text('Check-in:', L + 378, 44);
  doc
    .fontSize(8)
    .fillColor('#1A1A1A')
    .font('Helvetica-Bold')
    .text(dash(data.checkin), L + 422, 44, { width: 137, ellipsis: true });

  doc.moveTo(L, 60).lineTo(L + W, 60).strokeColor('#E0E0E0').lineWidth(1).stroke();

  let y = 66;

  const col2 = L + 260;
  const pair = (l1: string, v1: string, l2?: string, v2?: string) => {
    doc.font('Helvetica').fontSize(8).fillColor('#9E9E9E').text(l1, L, y);
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#1A1A1A').text(v1, L + 90, y, { width: 158, ellipsis: true });
    if (l2) {
      doc.font('Helvetica').fontSize(8).fillColor('#9E9E9E').text(l2, col2, y);
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#1A1A1A').text(v2 || '—', L + 360, y, { width: 163, ellipsis: true });
    }
    y += 12;
  };
  const bloco = (titulo: string) => {
    y += 2;
    doc.fontSize(8).fillColor('#616161').font('Helvetica-Bold').text(titulo.toUpperCase(), L, y);
    y += 11;
  };

  doc.fontSize(9).fillColor('#1A1A1A').font('Helvetica-Bold').text('1. DADOS DA OPERAÇÃO', L, y);
  y += 12;

  bloco('Unidade');
  doc.font('Helvetica').fontSize(8).fillColor('#9E9E9E').text('Contêiner:', L, y + 2);
  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor('#1A1A1A')
    .text(dash(data.containerNumero), L + 90, y, { width: 420, ellipsis: true });
  y += 16;
  pair('Tipo/tamanho:', `${dash(data.containerTipo)} / ${dash(data.containerTamanho)}`, 'Situação:', dash(data.containerSituacao));
  const ocrPorta = data.ocrPorta;
  if (ocrPorta?.tipoIso || ocrPorta?.mgwKg || ocrPorta?.taraKg) {
    const ocrLabel = [ocrPorta.tipoIso, ocrPorta.rotulo].filter(Boolean).join(' · ') || '—';
    const ocrColor =
      ocrPorta.status === 'CONFERE' ? '#2E7D32' : ocrPorta.status === 'DIVERGENTE' ? '#B45309' : '#616161';
    doc.font('Helvetica').fontSize(8).fillColor('#9E9E9E').text('OCR porta:', L, y);
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(ocrColor)
      .text(ocrLabel, L + 90, y, { width: 158, ellipsis: true });
    if (ocrPorta.cadastroLabel) {
      doc.font('Helvetica').fontSize(8).fillColor('#9E9E9E').text('vs cadastro:', col2, y);
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor('#1A1A1A')
        .text(ocrPorta.cadastroLabel, L + 360, y, { width: 163, ellipsis: true });
    }
    y += 12;
    if (ocrPorta.mgwKg || ocrPorta.taraKg) {
      pair(
        'MGW OCR:',
        ocrPorta.mgwKg ? `${ocrPorta.mgwKg} kg` : '—',
        ocrPorta.taraKg ? 'Tara OCR:' : undefined,
        ocrPorta.taraKg ? `${ocrPorta.taraKg} kg` : undefined,
      );
    }
    if (ocrPorta.payloadKg) {
      pair('Payload OCR:', `${ocrPorta.payloadKg} kg`, ocrPorta.owner ? 'Owner OCR:' : undefined, ocrPorta.owner);
    } else if (ocrPorta.owner) {
      pair('Owner OCR:', ocrPorta.owner);
    }
    doc
      .font('Helvetica')
      .fontSize(6)
      .fillColor('#9E9E9E')
      .text('Indicativo da foto da porta — não exige conferência.', L, y);
    y += 10;
  }
  if (isSituacaoCheio(data.containerSituacao)) {
    pair('Lacre:', dash(data.lacre), 'Direção:', dash(data.direcao));
    pair('Operação:', dash(data.tipoOperacao), 'Cliente:', dash(data.clienteNome));
    pair('Agendamento:', dash(data.agendamento), data.clienteCNPJ?.trim() ? 'CNPJ cliente:' : undefined, data.clienteCNPJ?.trim() ? formatCNPJForPDF(data.clienteCNPJ) : undefined);
  } else {
    pair('Direção:', dash(data.direcao), 'Operação:', dash(data.tipoOperacao));
    pair('Cliente:', dash(data.clienteNome), 'Agendamento:', dash(data.agendamento));
    if (data.clienteCNPJ?.trim()) {
      pair('CNPJ cliente:', formatCNPJForPDF(data.clienteCNPJ));
    }
  }

  bloco('Navio, processo e booking');
  pair('Navio:', dash(data.navio), 'Processo:', dash(data.processo));
  pair('Booking:', dash(data.booking));

  bloco('Transporte');
  pair('Transportadora:', dash(data.transportadoraNome), 'CNPJ transp.:', formatCNPJForPDF(data.transportadoraCNPJ ?? ''));
  pair('Caminhão:', dash(data.caminhao), 'Placa cavalo:', placaCavalo);
  pair('Placa carreta:', placaCarreta, placaCarreta02 ? 'Placa carreta 02:' : 'Motorista:', placaCarreta02 || data.motoristaNome);
  if (placaCarreta02) {
    pair('Motorista:', data.motoristaNome, 'CPF:', formatCPFForPDF(data.motoristaCPF));
  } else {
    pair('CPF:', formatCPFForPDF(data.motoristaCPF));
  }

  const observacaoRic = data.observacaoGate?.trim();
  if (observacaoRic) {
    doc.fillColor('#9E9E9E').font('Helvetica').fontSize(8).text('Observação:', L, y);
    doc
      .fillColor('#1A1A1A')
      .font('Helvetica')
      .text(observacaoRic, L + 70, y, { width: W - 70, ellipsis: true });
    y += 13;
  }

  y += 4;
  doc.moveTo(L, y).lineTo(L + W, y).strokeColor('#E0E0E0').lineWidth(0.5).stroke();
  y += 8;

  doc.fontSize(10).fillColor('#1A1A1A').font('Helvetica-Bold').text('2. VISTORIA FOTOGRÁFICA', L, y);
  y += 12;
  doc
    .fontSize(7)
    .fillColor('#555555')
    .font('Helvetica')
    .text(
      `${data.vistoria.portariaResponsavel} · ${formatDateTime(data.vistoria.dataVistoria)}`,
      L,
      y,
    );
  y += 11;

  const fotos = data.vistoria.fotos ?? [];
  const COLS = 3;
  const GAP = 6;
  const CELL_W = (W - GAP * (COLS - 1)) / COLS;
  const IMG_H = 66;
  const CAPTION_H = 16;
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

    doc.rect(x, fotoY, CELL_W, IMG_H).fillAndStroke('#F5F5F5', '#E0E0E0');

    const imgBuffer = decodeBase64Image(foto.imagem ?? '');
    if (imgBuffer && !isSvgPayload(foto.imagem ?? '', imgBuffer)) {
      try {
        doc.image(imgBuffer, x + 1, fotoY + 1, {
          fit: [CELL_W - 2, IMG_H - 2],
          align: 'center',
          valign: 'center',
        });
      } catch {
        /* placeholder já pintado */
      }
    }

    doc
      .fontSize(7)
      .fillColor('#1A1A1A')
      .font('Helvetica-Bold')
      .text(labelFotoTipo(foto.tipo), x, fotoY + IMG_H + 1, { width: CELL_W, ellipsis: true });

    if (foto.ocrResult) {
      doc
        .fontSize(6)
        .fillColor(foto.ocrMatch ? '#2E7D32' : '#C62828')
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

  y += 4;
  doc.fontSize(10).font('Helvetica-Bold');
  if (data.vistoria.avarias?.length > 0) {
    doc.fillColor('#C62828').text(`3. AVARIAS (${data.vistoria.avarias.length})`, L, y);
    y += 12;
    data.vistoria.avarias.forEach((avaria, idx) => {
      doc
        .fontSize(8)
        .fillColor('#1A1A1A')
        .font('Helvetica-Bold')
        .text(`${idx + 1}. ${avaria.localizacao}`, L, y, { width: W, ellipsis: true });
      y += 11;
      doc
        .fontSize(7)
        .fillColor('#555555')
        .font('Helvetica')
        .text(avaria.descricao, L, y, { width: W, ellipsis: true });
      y += 11;
    });
  } else {
    doc.fillColor('#2E7D32').text('3. AVARIAS', L, y);
    y += 12;
    doc.fontSize(8).fillColor('#555555').font('Helvetica').text('Nenhuma avaria registrada.', L, y);
    y += 12;
  }

  y += 4;
  doc.moveTo(L, y).lineTo(L + W, y).strokeColor('#E0E0E0').lineWidth(0.5).stroke();
  y += 8;

  doc.fontSize(10).fillColor('#1A1A1A').font('Helvetica-Bold').text('4. RECONFIRMAÇÃO DO GATE', L, y);
  y += 12;
  const checklistOk = Object.values(data.reconfirmacao.checklist ?? {}).every(Boolean);
  doc
    .fontSize(8)
    .fillColor('#555555')
    .font('Helvetica')
    .text(
      `${data.reconfirmacao.responsavel} · ${formatDateTime(data.reconfirmacao.dataReconfirmacao)} · ${checklistOk ? 'Validado' : 'Pendente'}`,
      L,
      y,
      { width: W, ellipsis: true },
    );
  y += 12;

  y += 2;
  doc.moveTo(L, y).lineTo(L + W, y).strokeColor('#E0E0E0').lineWidth(0.5).stroke();
  y += 8;

  const assinaturaManual = data.assinaturaModo === 'MANUAL';
  doc
    .fontSize(10)
    .fillColor('#1A1A1A')
    .font('Helvetica-Bold')
    .text(assinaturaManual ? '5. ASSINATURAS' : '5. ASSINATURA DO MOTORISTA', L, y);
  y += 12;

  const sigWidth = 230;
  const sigHeight = 46;
  const boxW = 240;
  const boxH = 44;
  const boxRight = L + W - boxW;

  if (assinaturaManual) {
    doc.rect(L, y, boxW, boxH).strokeColor('#BDBDBD').lineWidth(0.8).stroke();
    doc.rect(boxRight, y, boxW, boxH).strokeColor('#BDBDBD').lineWidth(0.8).stroke();
    doc
      .fontSize(7)
      .fillColor('#9E9E9E')
      .font('Helvetica')
      .text('Assine aqui', L, y + 16, { width: boxW, align: 'center' });
    doc.text('Assine aqui', boxRight, y + 16, { width: boxW, align: 'center' });
    y += boxH + 4;
    doc
      .fontSize(8)
      .fillColor('#1A1A1A')
      .font('Helvetica-Bold')
      .text(data.motoristaNome || 'Motorista', L, y, { width: boxW, align: 'center' });
    doc.text(data.operadorNome || 'Operador do Gate', boxRight, y, { width: boxW, align: 'center' });
    y += 11;
    doc
      .fontSize(7)
      .fillColor('#555555')
      .font('Helvetica')
      .text(`CPF: ${formatCPFForPDF(data.motoristaCPF)}`, L, y, { width: boxW, align: 'center' });
    doc.text(`CPF: ${formatCPFForPDF(data.operadorCPF ?? '')}`, boxRight, y, {
      width: boxW,
      align: 'center',
    });
    y += 10;
    doc
      .fontSize(7)
      .fillColor('#9E9E9E')
      .text('Motorista', L, y, { width: boxW, align: 'center' });
    doc.text('Operador do Gate', boxRight, y, { width: boxW, align: 'center' });
    y += 12;
  } else {
    const sigBuffer = decodeBase64Image(data.assinatura);
    if (sigBuffer) {
      try {
        doc.image(sigBuffer, L, y, { fit: [sigWidth, sigHeight] });
      } catch {
        /* noop */
      }
    }

    doc.moveTo(L, y + sigHeight).lineTo(L + sigWidth, y + sigHeight).strokeColor('#1A1A1A').lineWidth(1).stroke();
    doc
      .fontSize(8)
      .fillColor('#1A1A1A')
      .font('Helvetica-Bold')
      .text(data.motoristaNome, L, y + sigHeight + 3, { width: sigWidth, align: 'center' });
    doc
      .fontSize(7)
      .fillColor('#555555')
      .font('Helvetica')
      .text(`CPF: ${formatCPFForPDF(data.motoristaCPF)}`, L, y + sigHeight + 13, {
        width: sigWidth,
        align: 'center',
      });
    if (data.qrToken) {
      doc.fontSize(7).fillColor('#9E9E9E').font('Helvetica').text('Token:', boxRight, y);
      doc.fontSize(6).fillColor('#1A1A1A').font('Helvetica-Bold').text(data.qrToken, boxRight, y + 10, { width: boxW });
    }
    y += sigHeight + 28;
  }

  doc.moveTo(L, y).lineTo(L + W, y).strokeColor('#E0E0E0').lineWidth(0.5).stroke();
  y += 6;
  doc
    .fontSize(6)
    .fillColor('#9E9E9E')
    .font('Helvetica')
    .text(
      `${data.empresaNome || 'RL Transportes'} · ${formatDateTime(new Date().toISOString())} · ${data.protocolo}`,
      L,
      y,
      { align: 'center', width: W },
    );

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
