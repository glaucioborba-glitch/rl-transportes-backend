import { PassThrough } from 'stream';
import { PDFDocument } from '../common/pdf/pdfkit.util';
import { isAssinaturaBiometria } from './assinatura-ric.util';
import type { RICData } from './ric-pdf.service';

/** Frase única nas duas assinaturas do cupom térmico (motorista e operador). */
export const FRASE_IDENTIDADE_DIGITAL = 'Identidade confirmada por meio digital';

const MM = 72 / 25.4;
/** Largura do papel Epson TM-T20X. */
export const RIC_TERMICA_LARGURA_PT = 80 * MM;
const MARGIN = 4 * MM;
const PAGE_H = 400 * MM;

function dash(v?: string): string {
  return v?.trim() ? v.trim() : '—';
}

function formatDateTime(isoDate: string): string {
  if (!isoDate) return '—';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function formatCpf(cpf: string): string {
  if (!cpf) return '—';
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return cpf;
  return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function formatCnpj(cnpj: string): string {
  if (!cnpj) return '—';
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14) return cnpj;
  return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

export function usaRicTermica80(data: Pick<RICData, 'assinaturaModo' | 'assinatura'>): boolean {
  return data.assinaturaModo !== 'MANUAL' && isAssinaturaBiometria(data.assinatura);
}

/** Cupom 80 mm (Epson TM-T20X): dados aprovados, sem fotos e sem OCR. */
export function generateRicPdfTermica80(data: RICData): PassThrough {
  const stream = new PassThrough();
  const doc = new PDFDocument({
    size: [RIC_TERMICA_LARGURA_PT, PAGE_H],
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    info: {
      Title: `RIC ${data.protocolo}`,
      Author: data.empresaNome || 'RL Transportes',
      Subject: 'Recibo de Intercâmbio de Contêineres — cupom 80mm',
    },
  });
  doc.pipe(stream);

  const L = MARGIN;
  const W = RIC_TERMICA_LARGURA_PT - MARGIN * 2;
  let y = MARGIN;
  const empresaNome = (data.empresaNome || 'RL TRANSPORTES').toUpperCase();

  if (data.logoPng?.length) {
    try {
      doc.image(data.logoPng, L, y, { fit: [W, 28], align: 'center' });
      y += 32;
    } catch {
      doc.fontSize(7).fillColor('#111').font('Helvetica-Bold').text(empresaNome, L, y, {
        width: W,
        align: 'center',
      });
      y += 12;
    }
  } else {
    doc.fontSize(8).fillColor('#111').font('Helvetica-Bold').text(empresaNome, L, y, {
      width: W,
      align: 'center',
    });
    y += 12;
  }

  doc
    .fontSize(8)
    .fillColor('#111')
    .font('Helvetica-Bold')
    .text('RECIBO DE INTERCÂMBIO DE CONTÊINERES', L, y, { width: W, align: 'center' });
  y += 11;
  doc.fontSize(9).text('RIC', L, y, { width: W, align: 'center' });
  y += 14;

  doc.moveTo(L, y).lineTo(L + W, y).strokeColor('#000').lineWidth(0.8).stroke();
  y += 8;

  doc.fontSize(8).font('Helvetica').fillColor('#333').text('ID', L, y, { width: W, align: 'center' });
  y += 11;
  doc
    .fontSize(22)
    .font('Helvetica-Bold')
    .fillColor('#000')
    .text(dash(data.unidadeProcesso), L, y, { width: W, align: 'center' });
  y += 26;

  doc.font('Helvetica').fontSize(7).fillColor('#444').text('Protocolo', L, y, { width: W });
  y += 9;
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#000').text(dash(data.protocolo), L, y, { width: W });
  y += 12;
  doc.font('Helvetica').fontSize(7).fillColor('#444').text('Data e hora', L, y, { width: W });
  y += 9;
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#000')
    .text(data.checkin?.trim() || formatDateTime(data.dataAssinatura), L, y, { width: W });
  y += 14;

  doc.moveTo(L, y).lineTo(L + W, y).strokeColor('#000').lineWidth(0.6).stroke();
  y += 8;

  const linha = (label: string, valor: string) => {
    doc.font('Helvetica').fontSize(7).fillColor('#444').text(label, L, y, { width: W });
    y += 9;
    const h = doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#000')
      .heightOfString(valor, { width: W });
    doc.text(valor, L, y, { width: W });
    y += Math.max(12, h + 3);
  };

  const secao = (titulo: string) => {
    y += 3;
    doc.moveTo(L, y).lineTo(L + W, y).strokeColor('#000').lineWidth(0.4).stroke();
    y += 5;
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#000').text(titulo.toUpperCase(), L, y, { width: W });
    y += 12;
  };

  const placaCavalo = data.placaCavalo?.trim() || data.placa || '—';
  const placaCarreta = data.placaCarreta?.trim() || '—';
  const placaCarreta02 = data.placaCarreta02?.trim();

  secao('Unidade');
  linha('Contêiner', dash(data.containerNumero));
  linha('Tipo / tamanho', `${dash(data.containerTipo)} / ${dash(data.containerTamanho)}`);
  linha('Situação', dash(data.containerSituacao));
  if ((data.containerSituacao ?? '').trim().toUpperCase() === 'CHEIO') {
    linha('Lacre', dash(data.lacre));
  }
  linha('Direção', dash(data.direcao));
  linha('Operação', dash(data.tipoOperacao));
  linha('Cliente', dash(data.clienteNome));
  if (data.clienteCNPJ?.trim()) {
    linha('CNPJ cliente', formatCnpj(data.clienteCNPJ));
  }
  linha('Agendamento', dash(data.agendamento));

  secao('Transporte');
  linha('Transportadora', dash(data.transportadoraNome));
  if (data.transportadoraCNPJ?.trim()) {
    linha('CNPJ transp.', formatCnpj(data.transportadoraCNPJ));
  }
  linha('Caminhão', dash(data.caminhao));
  linha('Placa cavalo', placaCavalo);
  linha('Placa carreta', placaCarreta);
  if (placaCarreta02) {
    linha('Placa carreta 02', placaCarreta02);
  }
  linha('Motorista', dash(data.motoristaNome));
  linha('CPF motorista', formatCpf(data.motoristaCPF));

  const observacao = data.observacaoGate?.trim();
  if (observacao) {
    secao('Observação');
    const h = doc.font('Helvetica').fontSize(8).heightOfString(observacao, { width: W });
    doc.font('Helvetica').fontSize(8).fillColor('#000').text(observacao, L, y, { width: W });
    y += h + 6;
  }

  secao('Reconfirmação do Gate');
  linha('Responsavel', dash(data.reconfirmacao.responsavel));
  linha('Data', formatDateTime(data.reconfirmacao.dataReconfirmacao));
  const checklistOk = Object.values(data.reconfirmacao.checklist ?? {}).every(Boolean);
  linha('Checklist', checklistOk ? 'Validado' : 'Pendente');

  secao('Avarias');
  if (data.vistoria.avarias?.length) {
    data.vistoria.avarias.forEach((avaria, idx) => {
      linha(`${idx + 1}. ${dash(avaria.localizacao)}`, dash(avaria.descricao));
    });
  } else {
    linha('Registro', 'Nenhuma avaria');
  }

  const blocoAssinatura = (papel: string, nome: string, cpf: string) => {
    y += 4;
    doc.rect(L, y, W, 62).strokeColor('#000').lineWidth(0.7).stroke();
    const inner = y + 6;
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor('#000')
      .text(papel, L + 4, inner, { width: W - 8 });
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(dash(nome), L + 4, inner + 12, { width: W - 8 });
    doc
      .font('Helvetica')
      .fontSize(8)
      .text(`CPF: ${formatCpf(cpf)}`, L + 4, inner + 26, { width: W - 8 });
    doc
      .font('Helvetica-Oblique')
      .fontSize(8)
      .text(FRASE_IDENTIDADE_DIGITAL, L + 4, inner + 40, { width: W - 8 });
    y += 68;
  };

  secao('Assinaturas');
  blocoAssinatura('Motorista', data.motoristaNome, data.motoristaCPF);
  blocoAssinatura('Operador do Gate', data.operadorNome || 'Operador do Gate', data.operadorCPF ?? '');

  y += 4;
  doc.moveTo(L, y).lineTo(L + W, y).strokeColor('#000').lineWidth(0.5).stroke();
  y += 6;
  doc
    .font('Helvetica')
    .fontSize(6)
    .fillColor('#333')
    .text(
      `${data.empresaNome || 'RL Transportes'} · ${formatDateTime(data.dataAssinatura || new Date().toISOString())}`,
      L,
      y,
      { width: W, align: 'center' },
    );

  doc.end();
  return stream;
}
