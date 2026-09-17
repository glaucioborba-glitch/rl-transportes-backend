import { PDFDocument } from '../common/pdf/pdfkit.util';
import type { EmpresaOperadoraDados } from '../tenant/empresa-operadora.types';
import {
  diasNoPatio,
  formatCnpj,
  rotuloFiltrosSaldo,
  type PatioSaldoFiltro,
  type PatioSaldoUnidade,
} from './patio-saldo.util';

function dash(v?: string | null): string {
  const s = (v ?? '').trim();
  return s || '—';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR');
}

function enderecoEmpresa(e: EmpresaOperadoraDados): string {
  const linha1 = [e.logradouro, e.numero, e.complemento].filter((x) => x?.trim()).join(', ');
  const linha2 = [e.bairro, e.cidade && e.uf ? `${e.cidade}/${e.uf}` : e.cidade || e.uf]
    .filter((x) => x?.trim())
    .join(' — ');
  const cep = e.cep?.replace(/\D/g, '');
  const cepFmt = cep?.length === 8 ? cep.replace(/(\d{5})(\d{3})/, '$1-$2') : e.cep;
  return [linha1, linha2, cepFmt ? `CEP ${cepFmt}` : ''].filter(Boolean).join(' · ');
}

function rotuloSituacao(situacao: string): string {
  if (situacao === 'CHEIO') return 'Cheio';
  if (situacao === 'VAZIO') return 'Vazio';
  return dash(situacao);
}

export async function generateSaldoPdf(opts: {
  geradoEm: string;
  empresa: EmpresaOperadoraDados;
  logoPng?: Buffer | null;
  lotacaoTotal: number;
  capacidadeTotal: number;
  reefers: number;
  semBaia: number;
  filtros: PatioSaldoFiltro;
  unidades: PatioSaldoUnidade[];
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      bufferPages: true,
      margins: { top: 36, bottom: 36, left: 36, right: 36 },
      info: {
        Title: 'Saldo de Unidades',
        Author: opts.empresa.nomeFantasia || opts.empresa.razaoSocial || 'RL Transportes',
        Subject: 'Controle de unidades armazenadas no terminal',
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const L = 36;
    const W = 770;
    const nome = (opts.empresa.nomeFantasia || opts.empresa.razaoSocial || 'RL Transportes').toUpperCase();
    const razao = opts.empresa.razaoSocial || nome;
    const cnpj = formatCnpj(opts.empresa.cnpj);
    const endereco = enderecoEmpresa(opts.empresa);
    const contato = [opts.empresa.telefone, opts.empresa.email].filter((x) => x?.trim()).join(' · ');

    let y = 28;
    if (opts.logoPng?.length) {
      try {
        doc.image(opts.logoPng, L, y, { fit: [120, 36] });
      } catch {
        doc.fontSize(8).fillColor('#666').font('Helvetica-Bold').text(nome, L, y + 8);
      }
    } else {
      doc.fontSize(11).fillColor('#1A1A1A').font('Helvetica-Bold').text(nome, L, y + 6);
    }

    doc.fontSize(8).fillColor('#1A1A1A').font('Helvetica-Bold').text(razao, L + 140, y, {
      width: W - 140,
      align: 'right',
    });
    doc
      .fontSize(8)
      .fillColor('#555')
      .font('Helvetica')
      .text(`CNPJ ${cnpj}`, L + 140, y + 12, { width: W - 140, align: 'right' });
    if (endereco) {
      doc.fontSize(7).fillColor('#666').text(endereco, L + 140, y + 24, { width: W - 140, align: 'right' });
    }
    if (contato) {
      doc.fontSize(7).fillColor('#666').text(contato, L + 140, y + 34, { width: W - 140, align: 'right' });
    }

    y = 72;
    doc.moveTo(L, y).lineTo(L + W, y).strokeColor('#B0B0B0').lineWidth(1.2).stroke();
    y += 10;
    doc.fontSize(14).fillColor('#1A1A1A').font('Helvetica-Bold').text('SALDO DE UNIDADES', L, y);
    y += 18;
    doc
      .fontSize(8)
      .fillColor('#555')
      .font('Helvetica')
      .text('Controle do que está armazenado no terminal. Preenchimento de baia é opcional.', L, y);
    y += 14;
    doc
      .fontSize(8)
      .fillColor('#333')
      .text(
        `Emitido em ${formatDateTime(opts.geradoEm)}  ·  Filtros: ${rotuloFiltrosSaldo(opts.filtros)}  ·  ${opts.unidades.length} unidade(s)`,
        L,
        y,
      );
    y += 16;
    doc
      .fontSize(8)
      .fillColor('#333')
      .text(
        `Saldo ${opts.lotacaoTotal}  ·  Capacidade ${opts.capacidadeTotal || '—'}  ·  Reefers ${opts.reefers}  ·  Sem baia ${opts.semBaia}`,
        L,
        y,
      );

    y += 18;
    const cols: Array<{ key: string; label: string; w: number }> = [
      { key: 'iso', label: 'Contêiner', w: 90 },
      { key: 'id', label: 'ID', w: 40 },
      { key: 'tipo', label: 'Tipo', w: 38 },
      { key: 'situacao', label: 'Situação', w: 48 },
      { key: 'tamanho', label: 'Tam.', w: 40 },
      { key: 'baia', label: 'Baia', w: 44 },
      { key: 'entrada', label: 'Entrada', w: 54 },
      { key: 'dias', label: 'Dias', w: 28 },
      { key: 'cliente', label: 'Cliente', w: 108 },
      { key: 'processo', label: 'Processo', w: 90 },
      { key: 'booking', label: 'Booking', w: 90 },
      { key: 'navio', label: 'Navio', w: 100 },
    ];

    const drawHead = () => {
      doc.rect(L, y, W, 18).fill('#1A1A1A');
      let x = L + 4;
      doc.fontSize(7).fillColor('#FFFFFF').font('Helvetica-Bold');
      for (const c of cols) {
        doc.text(c.label, x, y + 5, { width: c.w - 6, ellipsis: true });
        x += c.w;
      }
      y += 18;
    };

    const pageBottom = 528;
    drawHead();
    doc.font('Helvetica').fillColor('#1A1A1A');

    if (!opts.unidades.length) {
      doc.fontSize(9).fillColor('#666').text('Nenhuma unidade com os filtros atuais.', L, y + 16);
    }

    opts.unidades.forEach((u, i) => {
      if (y > pageBottom) {
        doc.addPage({ size: 'A4', layout: 'landscape', margins: { top: 36, bottom: 36, left: 36, right: 36 } });
        y = 36;
        drawHead();
        doc.font('Helvetica').fillColor('#1A1A1A');
      }
      if (i % 2 === 0) {
        doc.rect(L, y, W, 16).fill('#F4F4F4');
      }
      const cells = [
        u.unidadeIso,
        u.processoNumero != null ? `ID ${u.processoNumero}` : '—',
        u.refrigerado ? 'Reefer' : 'Dry',
        rotuloSituacao(u.situacao),
        dash(u.tamanhoLabel || (u.tamanho ? `${u.tamanho}'` : '')),
        dash(u.baia),
        formatDate(u.entradaEm),
        String(diasNoPatio(u.entradaEm)),
        dash(u.cliente),
        dash(u.processo),
        dash(u.booking),
        dash(u.navio),
      ];
      let x = L + 4;
      doc.fontSize(7).fillColor('#1A1A1A');
      cells.forEach((text, idx) => {
        doc.text(text, x, y + 4, { width: cols[idx].w - 6, ellipsis: true });
        x += cols[idx].w;
      });
      y += 16;
    });

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc
        .fontSize(7)
        .fillColor('#888')
        .font('Helvetica')
        .text(
          `${nome} · documento interno · página ${i + 1} de ${range.count}`,
          L,
          548,
          { width: W, align: 'center' },
        );
    }

    doc.end();
  });
}
