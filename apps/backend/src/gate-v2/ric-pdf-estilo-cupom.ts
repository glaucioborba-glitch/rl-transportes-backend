import type PDFKit from 'pdfkit';
import { FRASE_IDENTIDADE_DIGITAL } from './ric-pdf-termica';
import type { RICData } from './ric-pdf.service';

export function ricDash(v?: string): string {
  return v?.trim() ? v.trim() : '—';
}

const RIC_TZ = 'America/Sao_Paulo' as const;

export function ricFormatDateTime(isoDate: string): string {
  if (!isoDate) return '—';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleString('pt-BR', { timeZone: RIC_TZ });
}

export function ricFormatCpf(cpf: string): string {
  if (!cpf) return '—';
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return cpf;
  return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

export function ricDataHoraCabecalho(data: Pick<RICData, 'checkin' | 'dataAssinatura'>): string {
  const checkin = data.checkin?.trim();
  if (checkin) return checkin;
  return ricFormatDateTime(data.dataAssinatura);
}

export function ricFormatCnpj(cnpj: string): string {
  if (!cnpj) return '—';
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14) return cnpj;
  return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

export function drawRicRegua(doc: PDFKit.PDFDocument, x: number, y: number, w: number, grossura = 0.6): number {
  doc.moveTo(x, y).lineTo(x + w, y).strokeColor('#000').lineWidth(grossura).stroke();
  return y + 6;
}

export function drawRicCabecalhoCupom(
  doc: PDFKit.PDFDocument,
  data: RICData,
  x: number,
  y: number,
  w: number,
  viaLabel?: string,
  compacto = false,
): number {
  const empresaNome = (data.empresaNome || 'RL TRANSPORTES').toUpperCase();
  const logoH = compacto ? 16 : 22;
  if (data.logoPng?.length) {
    try {
      doc.image(data.logoPng, x + w / 2 - 40, y, { fit: [80, logoH], align: 'center' });
      y += logoH + 4;
    } catch {
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#111').text(empresaNome, x, y, {
        width: w,
        align: 'center',
      });
      y += 12;
    }
  } else {
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#111').text(empresaNome, x, y, {
      width: w,
      align: 'center',
    });
    y += 12;
  }

  if (viaLabel) {
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#111').text(viaLabel, x, y, {
      width: w,
      align: 'right',
    });
  }
  doc
    .font('Helvetica-Bold')
    .fontSize(compacto ? 8 : 9)
    .fillColor('#111')
    .text('RECIBO DE INTERCÂMBIO DE CONTÊINERES', x, y, { width: w, align: 'center' });
  y += compacto ? 10 : 12;
  doc.fontSize(compacto ? 9 : 10).text('RIC', x, y, { width: w, align: 'center' });
  y += compacto ? 12 : 14;
  y = drawRicRegua(doc, x, y, w, 0.8);

  doc.font('Helvetica').fontSize(8).fillColor('#333').text('ID', x, y, { width: w, align: 'center' });
  y += compacto ? 9 : 11;
  doc
    .font('Helvetica-Bold')
    .fontSize(compacto ? 16 : 20)
    .fillColor('#000')
    .text(ricDash(data.unidadeProcesso), x, y, { width: w, align: 'center' });
  y += compacto ? 20 : 24;

  const metaFs = compacto ? 6.5 : 7;
  const valFs = compacto ? 8 : 8.5;
  const colW = (w - 10) / 2;
  doc.font('Helvetica').fontSize(metaFs).fillColor('#444').text('Protocolo', x, y, { width: colW });
  doc.font('Helvetica').fontSize(metaFs).fillColor('#444').text('Data e hora', x + colW + 10, y, { width: colW });
  y += compacto ? 8 : 9;
  doc
    .font('Helvetica-Bold')
    .fontSize(valFs)
    .fillColor('#000')
    .text(ricDash(data.protocolo), x, y, { width: colW, ellipsis: true });
  doc
    .font('Helvetica-Bold')
    .fontSize(valFs)
    .fillColor('#000')
    .text(ricDataHoraCabecalho(data), x + colW + 10, y, { width: colW, ellipsis: true });
  y += compacto ? 12 : 14;
  return drawRicRegua(doc, x, y, w, 0.6);
}

export function drawRicSecao(
  doc: PDFKit.PDFDocument,
  titulo: string,
  x: number,
  y: number,
  w: number,
): number {
  y += 2;
  y = drawRicRegua(doc, x, y, w, 0.4);
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#000').text(titulo.toUpperCase(), x, y, { width: w });
  return y + 11;
}

export function drawRicLinha(
  doc: PDFKit.PDFDocument,
  label: string,
  valor: string,
  x: number,
  y: number,
  w: number,
  opcoes?: { limiteY?: number; inline?: boolean },
): number {
  const limiteY = opcoes?.limiteY;
  if (limiteY !== undefined && y + 12 > limiteY) return y;
  if (opcoes?.inline) {
    const labelW = Math.min(78, w * 0.42);
    doc.font('Helvetica').fontSize(6.5).fillColor('#444').text(label, x, y, { width: labelW });
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor('#000')
      .text(valor, x + labelW, y, { width: w - labelW, ellipsis: true });
    return y + 11;
  }
  doc.font('Helvetica').fontSize(7).fillColor('#444').text(label, x, y, { width: w });
  y += 8;
  const h = doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000').heightOfString(valor, { width: w });
  doc.text(valor, x, y, { width: w });
  return y + Math.max(10, h + 2);
}

export function drawRicCamposDuasColunas(
  doc: PDFKit.PDFDocument,
  data: RICData,
  x: number,
  y: number,
  w: number,
  opcoes?: { incluirAvarias?: boolean; limiteY?: number; inline?: boolean },
): number {
  const gap = 14;
  const colW = (w - gap) / 2;
  const leftX = x;
  const rightX = x + colW + gap;
  let yL = y;
  let yR = y;
  const limiteY = opcoes?.limiteY;
  const inline = Boolean(opcoes?.inline);

  const secaoL = (titulo: string) => {
    yL = drawRicSecao(doc, titulo, leftX, yL, colW);
  };
  const secaoR = (titulo: string) => {
    yR = drawRicSecao(doc, titulo, rightX, yR, colW);
  };
  const linhaL = (label: string, valor: string) => {
    yL = drawRicLinha(doc, label, valor, leftX, yL, colW, { limiteY, inline });
  };
  const linhaR = (label: string, valor: string) => {
    yR = drawRicLinha(doc, label, valor, rightX, yR, colW, { limiteY, inline });
  };

  const placaCavalo = data.placaCavalo?.trim() || data.placa || '—';
  const placaCarreta = data.placaCarreta?.trim() || '—';
  const placaCarreta02 = data.placaCarreta02?.trim();

  secaoL('Unidade');
  linhaL('Contêiner', ricDash(data.containerNumero));
  linhaL('Tipo / tamanho', `${ricDash(data.containerTipo)} / ${ricDash(data.containerTamanho)}`);
  linhaL('Situação', ricDash(data.containerSituacao));
  if ((data.containerSituacao ?? '').trim().toUpperCase() === 'CHEIO') {
    linhaL('Lacre', ricDash(data.lacre));
  }
  linhaL('Direção', ricDash(data.direcao));
  linhaL('Operação', ricDash(data.tipoOperacao));
  linhaL('Cliente', ricDash(data.clienteNome));
  if (data.clienteCNPJ?.trim()) {
    linhaL('CNPJ cliente', ricFormatCnpj(data.clienteCNPJ));
  }
  linhaL('Booking', ricDash(data.booking));
  linhaL('Processo', ricDash(data.processo));
  linhaL('Navio', ricDash(data.navio));
  linhaL('Agendamento', ricDash(data.agendamento));

  secaoR('Transporte');
  linhaR('Transportadora', ricDash(data.transportadoraNome));
  if (data.transportadoraCNPJ?.trim()) {
    linhaR('CNPJ transp.', ricFormatCnpj(data.transportadoraCNPJ));
  }
  linhaR('Caminhão', ricDash(data.caminhao));
  linhaR('Placa cavalo', placaCavalo);
  linhaR('Placa carreta', placaCarreta);
  if (placaCarreta02) {
    linhaR('Placa carreta 02', placaCarreta02);
  }
  linhaR('Motorista', ricDash(data.motoristaNome));
  linhaR('CPF motorista', ricFormatCpf(data.motoristaCPF));

  const observacao = data.observacaoGate?.trim();
  if (observacao) {
    secaoR('Observação');
    if (limiteY === undefined || yR + 12 < limiteY) {
      const h = doc.font('Helvetica').fontSize(8).heightOfString(observacao, { width: colW });
      doc.font('Helvetica').fontSize(8).fillColor('#000').text(observacao, rightX, yR, { width: colW });
      yR += h + 6;
    }
  }

  secaoR('Reconfirmação do Gate');
  linhaR('Responsavel', ricDash(data.reconfirmacao.responsavel));
  linhaR('Data', ricFormatDateTime(data.reconfirmacao.dataReconfirmacao));
  const checklistOk = Object.values(data.reconfirmacao.checklist ?? {}).every(Boolean);
  linhaR('Checklist', checklistOk ? 'Validado' : 'Pendente');

  if (opcoes?.incluirAvarias) {
    secaoR('Avarias');
    if (data.vistoria.avarias?.length) {
      data.vistoria.avarias.slice(0, 3).forEach((avaria, idx) => {
        linhaR(`${idx + 1}. ${ricDash(avaria.localizacao)}`, ricDash(avaria.descricao));
      });
    } else {
      linhaR('Registro', 'Nenhuma avaria');
    }
  }

  return Math.max(yL, yR);
}

export function drawRicCaixaAssinatura(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  papel: string,
  nome: string,
  cpf: string,
  modo: 'manual' | 'digital',
): void {
  doc.rect(x, y, w, h).strokeColor('#000').lineWidth(0.7).stroke();
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#000').text(papel, x + 6, y + 6, { width: w - 12 });
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .text(ricDash(nome), x + 6, y + 18, { width: w - 12, ellipsis: true });
  doc.font('Helvetica').fontSize(8).text(`CPF: ${ricFormatCpf(cpf)}`, x + 6, y + 32, { width: w - 12 });
  if (modo === 'digital') {
    doc
      .font('Helvetica-Oblique')
      .fontSize(8)
      .text(FRASE_IDENTIDADE_DIGITAL, x + 6, y + 46, { width: w - 12 });
  } else {
    doc
      .moveTo(x + 8, y + h - 18)
      .lineTo(x + w - 8, y + h - 18)
      .strokeColor('#000')
      .lineWidth(0.4)
      .stroke();
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor('#555')
      .text('Assine aqui', x, y + h - 14, { width: w, align: 'center' });
  }
}

export function drawRicParAssinaturas(
  doc: PDFKit.PDFDocument,
  data: RICData,
  x: number,
  y: number,
  w: number,
  modo: 'manual' | 'digital',
): number {
  y = drawRicSecao(doc, 'Assinaturas', x, y, w);
  const gap = 10;
  const boxW = (w - gap) / 2;
  const boxH = modo === 'digital' ? 64 : 62;
  drawRicCaixaAssinatura(
    doc,
    x,
    y,
    boxW,
    boxH,
    'Motorista',
    data.motoristaNome,
    data.motoristaCPF,
    modo,
  );
  drawRicCaixaAssinatura(
    doc,
    x + boxW + gap,
    y,
    boxW,
    boxH,
    'Operador do Gate',
    data.operadorNome || 'Operador do Gate',
    data.operadorCPF ?? '',
    modo,
  );
  return y + boxH + 8;
}

export function drawRicRodape(
  doc: PDFKit.PDFDocument,
  data: RICData,
  x: number,
  y: number,
  w: number,
): number {
  y = drawRicRegua(doc, x, y, w, 0.5);
  doc
    .font('Helvetica')
    .fontSize(6)
    .fillColor('#333')
    .text(
      `${data.empresaNome || 'RL Transportes'} · ${ricFormatDateTime(data.dataAssinatura || new Date().toISOString())}`,
      x,
      y,
      { width: w, align: 'center' },
    );
  return y + 10;
}
