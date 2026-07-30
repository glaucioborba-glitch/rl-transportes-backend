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
  motoristaNome: string;
  motoristaCPF: string;
  transportadoraNome: string;
  transportadoraCNPJ: string;
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
  dataAssinatura: string;
  qrToken: string;
};

const CHECKLIST_LABELS: Record<string, string> = {
  containerConfere: 'Número do contêiner confere',
  tipoConfere: 'Tipo e tamanho conferem',
  situacaoConfere: 'Situação (cheio/vazio) confere',
  placaConfere: 'Placa do veículo confere',
  motoristaConfere: 'Motorista confere com documento',
  fotosOk: 'Fotos da vistoria estão legíveis',
  semAvariasCriticas: 'Sem avarias críticas que impeçam a operação',
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

/** Gera o RIC em PDF e retorna stream para pipe na resposta HTTP. */
export function generateRICPDF(data: RICData): PassThrough {
  const stream = new PassThrough();
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    info: {
      Title: `RIC - ${data.protocolo}`,
      Author: 'RL Transportes',
      Subject: 'Relatório de Inspeção de Contêiner',
    },
  });

  doc.pipe(stream);

  doc.fontSize(8).fillColor('#9E9E9E').text('RL TRANSPORTES', 50, 40, { align: 'center', width: 495 });
  doc
    .fontSize(16)
    .fillColor('#1A1A1A')
    .font('Helvetica-Bold')
    .text('RELATÓRIO DE INSPEÇÃO DE CONTÊINER (RIC)', 50, 55, { align: 'center', width: 495 });
  doc
    .fontSize(9)
    .fillColor('#555555')
    .font('Helvetica')
    .text(`Protocolo: ${data.protocolo}`, 50, 75, { align: 'center', width: 495 });

  doc.moveTo(50, 88).lineTo(545, 88).strokeColor('#E0E0E0').lineWidth(1).stroke();

  let y = 100;

  doc.fontSize(11).fillColor('#1A1A1A').font('Helvetica-Bold').text('1. DADOS DA OPERAÇÃO', 50, y);
  y += 20;

  const dadosOp: Array<[string, string, string, string]> = [
    ['Contêiner:', data.containerNumero, 'Tipo/Tamanho:', `${data.containerTipo} / ${data.containerTamanho}`],
    ['Situação:', data.containerSituacao, 'Operação:', data.tipoOperacao],
    ['Placa:', data.placa, 'Data Vistoria:', formatDate(data.vistoria.dataVistoria)],
    ['Motorista:', data.motoristaNome, 'CPF:', formatCPFForPDF(data.motoristaCPF)],
    ['Transportadora:', data.transportadoraNome, 'CNPJ:', formatCNPJForPDF(data.transportadoraCNPJ)],
    ['Cliente:', data.clienteNome, 'CNPJ:', formatCNPJForPDF(data.clienteCNPJ)],
  ];

  doc.font('Helvetica').fontSize(9);
  for (const [label1, val1, label2, val2] of dadosOp) {
    doc.fillColor('#9E9E9E').text(label1, 50, y);
    doc.fillColor('#1A1A1A').font('Helvetica-Bold').text(val1, 130, y);
    doc.fillColor('#9E9E9E').font('Helvetica').text(label2, 300, y);
    doc.fillColor('#1A1A1A').font('Helvetica-Bold').text(val2 || '—', 400, y);
    y += 16;
  }

  y += 10;
  doc.moveTo(50, y).lineTo(545, y).strokeColor('#E0E0E0').lineWidth(0.5).stroke();
  y += 15;

  doc.fontSize(11).fillColor('#1A1A1A').font('Helvetica-Bold').text('2. VISTORIA FOTOGRÁFICA', 50, y);
  y += 18;
  doc
    .fontSize(8)
    .fillColor('#555555')
    .font('Helvetica')
    .text(
      `Responsável: ${data.vistoria.portariaResponsavel} · ${formatDateTime(data.vistoria.dataVistoria)}`,
      50,
      y,
    );
  y += 15;

  const fotos = data.vistoria.fotos ?? [];
  const fotoWidth = 220;
  const fotoHeight = 140;
  const colGap = 30;

  for (let i = 0; i < fotos.length; i++) {
    const foto = fotos[i];
    const col = i % 2;
    const row = Math.floor(i / 2);
    let fotoY = y + row * (fotoHeight + 35);

    if (fotoY + fotoHeight + 40 > 720) {
      doc.addPage();
      y = 50;
      fotoY = y + Math.floor(i / 2) * (fotoHeight + 35);
    }

    const x = 50 + col * (fotoWidth + colGap);
    doc.rect(x, fotoY, fotoWidth, fotoHeight).strokeColor('#E0E0E0').lineWidth(0.5).stroke();

    const imgBuffer = decodeBase64Image(foto.imagem);
    if (imgBuffer) {
      try {
        doc.image(imgBuffer, x + 1, fotoY + 1, {
          fit: [fotoWidth - 2, fotoHeight - 2],
          align: 'center',
          valign: 'center',
        });
      } catch {
        doc
          .fillColor('#E0E0E0')
          .fontSize(8)
          .text('Erro ao carregar imagem', x, fotoY + fotoHeight / 2, { width: fotoWidth, align: 'center' });
      }
    }

    doc
      .fontSize(8)
      .fillColor('#1A1A1A')
      .font('Helvetica-Bold')
      .text(foto.tipo.replace(/_/g, ' '), x, fotoY + fotoHeight + 3, { width: fotoWidth });

    if (foto.ocrResult) {
      const confiancaPct = Math.round((foto.ocrConfianca ?? 0) * 100);
      const provider = foto.ocrProvider ?? 'N/A';
      doc
        .fontSize(7)
        .fillColor(foto.ocrMatch ? '#4CAF50' : '#F44336')
        .font('Helvetica')
        .text(
          `OCR: ${foto.ocrResult} ${foto.ocrMatch ? 'OK' : 'DIVERGE'} (${confiancaPct}% · ${provider})`,
          x,
          fotoY + fotoHeight + 15,
          { width: fotoWidth },
        );
    }

    if (col === 1 || i === fotos.length - 1) {
      y = fotoY + fotoHeight + 25;
    }
  }

  y += 5;

  if (data.vistoria.avarias?.length > 0) {
    if (y > 680) {
      doc.addPage();
      y = 50;
    }
    doc
      .fontSize(11)
      .fillColor('#F44336')
      .font('Helvetica-Bold')
      .text(`3. AVARIAS REGISTRADAS (${data.vistoria.avarias.length})`, 50, y);
    y += 20;

    data.vistoria.avarias.forEach((avaria, idx) => {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }
      const avWidth = 100;
      const avHeight = 75;
      const avImg = decodeBase64Image(avaria.foto);
      if (avImg) {
        try {
          doc.image(avImg, 50, y, { fit: [avWidth, avHeight] });
        } catch {
          /* noop */
        }
      }
      doc.rect(50, y, avWidth, avHeight).strokeColor('#F44336').lineWidth(0.5).stroke();
      doc.fontSize(8).fillColor('#9E9E9E').font('Helvetica').text(`Avaria #${idx + 1}`, 160, y);
      doc.fontSize(9).fillColor('#1A1A1A').font('Helvetica-Bold').text(avaria.localizacao, 160, y + 12);
      doc.fontSize(8).fillColor('#555555').font('Helvetica').text(avaria.descricao, 160, y + 26, { width: 380 });
      y += avHeight + 15;
    });
  } else {
    if (y > 680) {
      doc.addPage();
      y = 50;
    }
    doc.fontSize(11).fillColor('#4CAF50').font('Helvetica-Bold').text('3. AVARIAS', 50, y);
    y += 18;
    doc.fontSize(9).fillColor('#555555').font('Helvetica').text('Nenhuma avaria registrada na vistoria.', 50, y);
    y += 20;
  }

  y += 10;
  if (y > 680) {
    doc.addPage();
    y = 50;
  }
  doc.moveTo(50, y).lineTo(545, y).strokeColor('#E0E0E0').lineWidth(0.5).stroke();
  y += 15;

  doc.fontSize(11).fillColor('#1A1A1A').font('Helvetica-Bold').text('4. RECONFIRMAÇÃO DO GATE', 50, y);
  y += 20;
  doc
    .fontSize(9)
    .fillColor('#555555')
    .font('Helvetica')
    .text(
      `Responsável: ${data.reconfirmacao.responsavel} · ${formatDateTime(data.reconfirmacao.dataReconfirmacao)}`,
      50,
      y,
    );
  y += 18;

  for (const [key, value] of Object.entries(data.reconfirmacao.checklist ?? {})) {
    doc
      .fontSize(9)
      .fillColor(value ? '#4CAF50' : '#F44336')
      .font('Helvetica-Bold')
      .text(value ? '[OK]' : '[X]', 50, y);
    doc.fillColor('#555555').font('Helvetica').text(CHECKLIST_LABELS[key] ?? key, 80, y);
    y += 14;
  }

  y += 10;
  if (y > 650) {
    doc.addPage();
    y = 50;
  }
  doc.moveTo(50, y).lineTo(545, y).strokeColor('#E0E0E0').lineWidth(0.5).stroke();
  y += 20;

  doc.fontSize(11).fillColor('#1A1A1A').font('Helvetica-Bold').text('5. ASSINATURA DO MOTORISTA', 50, y);
  y += 20;

  const sigWidth = 250;
  const sigHeight = 80;
  const sigBuffer = decodeBase64Image(data.assinatura);
  if (sigBuffer) {
    try {
      doc.image(sigBuffer, 50, y, { fit: [sigWidth, sigHeight] });
    } catch {
      /* noop */
    }
  }

  doc.moveTo(50, y + sigHeight).lineTo(300, y + sigHeight).strokeColor('#1A1A1A').lineWidth(1).stroke();
  doc
    .fontSize(8)
    .fillColor('#9E9E9E')
    .font('Helvetica')
    .text(data.motoristaNome, 50, y + sigHeight + 5, { width: 250, align: 'center' });
  doc.text(`Assinado digitalmente em ${formatDateTime(data.dataAssinatura)}`, 50, y + sigHeight + 17, {
    width: 250,
    align: 'center',
  });

  if (data.qrToken) {
    doc.fontSize(8).fillColor('#9E9E9E').font('Helvetica').text('Token de validação:', 350, y);
    doc.fontSize(7).fillColor('#1A1A1A').font('Helvetica-Bold').text(data.qrToken, 350, y + 12, { width: 195 });
    doc
      .fontSize(7)
      .fillColor('#9E9E9E')
      .font('Helvetica')
      .text('Verifique a autenticidade deste documento no sistema RL Transportes.', 350, y + 30, {
        width: 195,
      });
  }

  y += sigHeight + 40;

  if (y > 770) {
    doc.addPage();
    y = 50;
  }
  doc.moveTo(50, y).lineTo(545, y).strokeColor('#E0E0E0').lineWidth(0.5).stroke();
  y += 8;
  doc
    .fontSize(7)
    .fillColor('#9E9E9E')
    .font('Helvetica')
    .text('RL Transportes — Terminal de Apoio Logístico · Itajaí/SC', 50, y, { align: 'center', width: 495 });
  doc.text(
    `Documento gerado eletronicamente em ${formatDateTime(new Date().toISOString())} · Protocolo: ${data.protocolo}`,
    50,
    y + 10,
    { align: 'center', width: 495 },
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
