import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as handlebars from 'handlebars';
import puppeteer, { type Browser } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import QRCode from 'qrcode';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import { SolicitacoesV2Service } from '../modules/solicitacoes-v2/solicitacoes-v2.service';
import { RedisService } from '../redis/redis.service';
import { diffAntifraudPayloads, gerarHashAntiFraude } from './utils/hash-antifraude';

const PDF_SNAPSHOT_TTL_SEC = 15552000; // 180 dias

const STAFF_ROLES_PDF: Role[] = [
  Role.ADMIN,
  Role.GERENTE,
  Role.OPERADOR_PORTARIA,
  Role.OPERADOR_GATE,
  Role.OPERADOR_PATIO,
];

export type DetalheStaff = NonNullable<Awaited<ReturnType<SolicitacoesV2Service['obterDetalheStaff']>>>;

export type VerificacaoPdfResult = {
  valido: boolean;
  divergencias: Array<{ campo: string; antes?: unknown; depois?: unknown; mensagem?: string }>;
  riscoMax: number | null;
  totalAlertas: number;
  protocolo?: string;
};

@Injectable()
export class PdfOperacionalV2Service {
  private readonly logger = new Logger(PdfOperacionalV2Service.name);

  constructor(
    private readonly solicitacoesV2: SolicitacoesV2Service,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  private templateDir(): string {
    return path.join(__dirname, 'templates');
  }

  private resolveLogoDataUri(): string {
    try {
      const p = path.join(__dirname, 'assets', 'logo.png');
      if (fs.existsSync(p)) {
        const buf = fs.readFileSync(p);
        return `data:image/png;base64,${buf.toString('base64')}`;
      }
    } catch {
      /* fallback SVG */
    }
    const svg = encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="40" viewBox="0 0 160 40"><rect width="160" height="40" fill="#1a1a1a"/><text x="80" y="26" text-anchor="middle" fill="#e5e5e5" font-family="Arial" font-size="14" font-weight="bold">RL TRANSPORTES</text></svg>`,
    );
    return `data:image/svg+xml;charset=utf-8,${svg}`;
  }

  private loadTemplate(): handlebars.TemplateDelegate {
    handlebars.registerHelper('fmtIsoDate', (d: unknown) => {
      if (d == null) return '—';
      if (d instanceof Date) return d.toISOString().slice(0, 10);
      const s = String(d);
      return s.length >= 10 ? s.slice(0, 10) : s;
    });
    handlebars.registerHelper('fmtDateTime', (d: unknown) => {
      if (d == null) return '—';
      const dt = d instanceof Date ? d : new Date(String(d));
      if (Number.isNaN(dt.getTime())) return String(d);
      return dt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    });
    const tplPath = path.join(this.templateDir(), 'solicitacao-v2.hbs');
    const src = fs.readFileSync(tplPath, 'utf8');
    return handlebars.compile(src);
  }

  private labelTipoCaminhao(raw: string | null | undefined): string {
    const t = String(raw ?? '').trim();
    if (t === 'LS') return 'LS (Line Set)';
    if (t === 'RODOTREM') return 'Rodotrem';
    return t || '—';
  }

  private labelTurno(raw: string | null | undefined): string {
    const t = String(raw ?? '').trim();
    if (t === 'MANHA') return 'Manhã';
    if (t === 'TARDE') return 'Tarde';
    return t || '—';
  }

  private resumirAuditoria(
    a: { dadosAntes: unknown; dadosDepois: unknown; acao: string },
  ): string {
    try {
      const dep = a.dadosDepois;
      if (dep != null && typeof dep === 'object' && !Array.isArray(dep)) {
        const o = dep as Record<string, unknown>;
        const deltas = o['deltas'];
        if (Array.isArray(deltas) && deltas.length) {
          return deltas
            .slice(0, 5)
            .map((d: unknown) => {
              if (d && typeof d === 'object' && 'campo' in d) {
                const x = d as { campo: unknown; antes?: unknown; depois?: unknown };
                return `${x.campo}: ${JSON.stringify(x.antes)} → ${JSON.stringify(x.depois)}`;
              }
              return JSON.stringify(d);
            })
            .join(' · ');
        }
      }
      const s = JSON.stringify(dep);
      return s.length > 220 ? `${s.slice(0, 217)}…` : s;
    } catch {
      return String(a.acao);
    }
  }

  private fotoUrlToMiniDataUri(url: string): string | null {
    if (!url?.startsWith('local://')) return null;
    const rel = url.slice('local://'.length);
    const full = path.join(process.cwd(), 'uploads', 'solicitacoes', rel);
    try {
      if (!fs.existsSync(full)) return null;
      const buf = fs.readFileSync(full);
      const ext = path.extname(full).toLowerCase();
      const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
      return `data:${mime};base64,${buf.toString('base64')}`;
    } catch {
      return null;
    }
  }

  private maiorRiscoDetectado(
    alerts: Array<{ risco: number | null; tipo: string }>,
  ): string {
    let max = -1;
    let tipo = '';
    for (const al of alerts) {
      const r = al.risco != null ? Number(al.risco) : NaN;
      if (!Number.isNaN(r) && r > max) {
        max = r;
        tipo = al.tipo;
      }
    }
    if (max < 0) return '—';
    return `${tipo || 'alerta'} (nível ${max})`;
  }

  private viewModelPdf(
    detalhe: DetalheStaff,
    dados: {
      s: Record<string, unknown>;
      ts?: Record<string, unknown>;
      containers: Record<string, unknown>[];
      ag?: Record<string, unknown>;
      ct?: Record<string, unknown>;
      cli?: Record<string, unknown>;
      anexos: Record<string, unknown>[];
      resumoRisco?: { totalAlertas: number; riscoMax: number | null };
      hash: string;
    },
  ) {
    const s = dados.s as Record<string, unknown>;
    const ts = dados.ts as Record<string, unknown> | undefined;
    const ag = dados.ag as Record<string, unknown> | undefined;
    const ct = dados.ct as Record<string, unknown> | undefined;

    const containersSorted = [...dados.containers].sort(
      (a, b) => Number((a as Record<string, unknown>).ordem) - Number((b as Record<string, unknown>).ordem),
    );
    const c1 = containersSorted[0] as Record<string, unknown> | undefined;
    const c2 = containersSorted[1] as Record<string, unknown> | undefined;

    const anexoLinhas = dados.anexos.map((raw) => {
      const a = raw as Record<string, unknown>;
      const size = Number(a.size ?? 0);
      return {
        nome: String(a.filename ?? '—'),
        mime: String(a.mimeType ?? '—'),
        kb: (size / 1024).toFixed(1),
      };
    });

    const auditoriaLinhas = detalhe.auditoria.map((au) => ({
      quando: au.createdAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      acao: String(au.acao),
      detalhe: this.resumirAuditoria(au),
    }));

    const alertsForRisco = detalhe.securityAlerts.map((al) => ({
      risco: al.risco != null ? Number(al.risco) : null,
      tipo: al.tipo,
    }));

    const gateInsRaw = ((s as Record<string, unknown>).gateCheckIns as Record<string, unknown>[]) ?? [];
    const gateOperacoes = gateInsRaw.map((gi) => {
      const fotosE = (Array.isArray(gi.fotosEntrada) ? gi.fotosEntrada : []) as string[];
      const co = gi.checkOut as Record<string, unknown> | undefined;
      const fotosS =
        co && Array.isArray(co.fotosSaida) ? (co.fotosSaida as string[]) : [];
      const opIn = gi.operador as { email?: string } | undefined;
      return {
        id: String(gi.id ?? ''),
        dataHoraLocal: (gi.dataHora as Date).toLocaleString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
        }),
        placaCavalo: String(gi.placaCavalo ?? ''),
        operador: opIn?.email ?? '—',
        divergenciasInResumo: JSON.stringify(gi.divergenciasJson ?? []).slice(0, 500),
        miniEntrada: fotosE
          .slice(0, 4)
          .map((u) => this.fotoUrlToMiniDataUri(u))
          .filter((x): x is string => Boolean(x)),
        checkout: co
          ? {
              dataHoraLocal: (co.dataHora as Date).toLocaleString('pt-BR', {
                timeZone: 'America/Sao_Paulo',
              }),
              operador: (co.operador as { email?: string } | undefined)?.email ?? '—',
              divergenciasResumo: JSON.stringify(co.divergenciasJson ?? []).slice(0, 500),
              miniSaida: fotosS
                .slice(0, 4)
                .map((u) => this.fotoUrlToMiniDataUri(u))
                .filter((x): x is string => Boolean(x)),
            }
          : null,
      };
    });
    const carimboPortariaGate = gateInsRaw.length > 0;

    return {
      protocolo: String(s.protocolo ?? '—'),
      dataCriacaoSolicitacao: (s.createdAt as Date).toISOString(),
      statusDb: String(s.status ?? '—'),
      statusV2Label: detalhe.statusV2Label ?? '—',
      solicitanteNome: ct ? String(ct.nome ?? '—') : '—',
      solicitanteTelefone: ct ? String(ct.telefone ?? '—') : '—',
      solicitanteEmail: ct ? String(ct.email ?? '—') : '—',
      tipoCaminhaoLabel: this.labelTipoCaminhao(ts ? String(ts.tipoCaminhao) : null),
      motoristaNome: ts ? String(ts.nomeMotorista ?? '—') : '—',
      motoristaCpf: ts ? String(ts.cpfMotorista ?? '—') : '—',
      placaCavalo: ts ? String(ts.placaCavalo ?? '—') : '—',
      placaCarreta01: ts ? String(ts.placaCarreta01 ?? '—') : '—',
      placaCarreta02: ts?.placaCarreta02 != null ? String(ts.placaCarreta02) : null,
      agendamentoDataRef: ag?.dataRef,
      turnoLabel: ag ? this.labelTurno(String(ag.turno)) : '—',
      atendimentoEspecial: ag ? Boolean(ag.atendimentoEspecial) : false,
      atendimentoEspecialTexto: ag?.atendimentoEspecialTexto != null ? String(ag.atendimentoEspecialTexto) : null,
      container1: c1
        ? {
            ordem: Number(c1.ordem),
            unidade: String(c1.unidade ?? ''),
            booking: String(c1.booking ?? ''),
            processo: String(c1.processo ?? ''),
            tamanho: String(c1.tamanho ?? ''),
            tipo: String(c1.tipo ?? ''),
            status: String(c1.status ?? ''),
            mostrarLacre: String(c1.status ?? '') === 'CHEIO',
            lacre: c1.lacre != null ? String(c1.lacre) : null,
            refrigerado: Boolean(c1.refrigerado),
            setPoint: c1.setPoint != null && c1.setPoint !== '' ? Number(c1.setPoint) : null,
          }
        : null,
      container2: c2
        ? {
            ordem: Number(c2.ordem),
            unidade: String(c2.unidade ?? ''),
            booking: String(c2.booking ?? ''),
            processo: String(c2.processo ?? ''),
            tamanho: String(c2.tamanho ?? ''),
            tipo: String(c2.tipo ?? ''),
            status: String(c2.status ?? ''),
            mostrarLacre: String(c2.status ?? '') === 'CHEIO',
            lacre: c2.lacre != null ? String(c2.lacre) : null,
            refrigerado: Boolean(c2.refrigerado),
            setPoint: c2.setPoint != null && c2.setPoint !== '' ? Number(c2.setPoint) : null,
          }
        : null,
      anexoLinhas,
      timeline: detalhe.timeline,
      auditoriaLinhas,
      riskScore: dados.resumoRisco?.riscoMax ?? null,
      totalAlertas: dados.resumoRisco?.totalAlertas ?? 0,
      maiorRiscoDetectado: this.maiorRiscoDetectado(alertsForRisco),
      hashCompacto:
        dados.hash.length > 16 ? `${dados.hash.slice(0, 8)}…${dados.hash.slice(-6)}` : dados.hash,
      gateOperacoes,
      carimboPortariaGate,
    };
  }

  montarPayloadAntifraude(params: {
    solicitacaoId: string;
    protocolo: string;
    clienteId: string;
    createdAt: string;
    updatedAt: string;
    tipoCaminhao: string | null;
    containers: Array<{
      ordem: number;
      status: string;
      lacre: string | null;
      refrigerado: boolean;
      setPoint: number | null;
    }>;
    riskScore: number | null;
    fingerprint: string;
    ultimoGateCheckInId: string | null;
    ultimoGateCheckOutId: string | null;
  }): Record<string, unknown> {
    return {
      solicitacaoId: params.solicitacaoId,
      protocolo: params.protocolo,
      clienteId: params.clienteId,
      createdAt: params.createdAt,
      updatedAt: params.updatedAt,
      tipoCaminhao: params.tipoCaminhao,
      containers: params.containers,
      riskScore: params.riskScore,
      fingerprint: params.fingerprint,
      ultimoGateCheckInId: params.ultimoGateCheckInId,
      ultimoGateCheckOutId: params.ultimoGateCheckOutId,
    };
  }

  buildAntifraudPayloadFromDetalhe(detalhe: DetalheStaff, fingerprint: string): Record<string, unknown> {
    const s = detalhe.solicitacao as Record<string, unknown>;
    const ts = s.transporteSolicitacao as Record<string, unknown> | undefined;
    const containers = (s.containersSolicitacao as Record<string, unknown>[]) ?? [];

    const containersNorm = [...containers]
      .sort((a, b) => Number(a.ordem) - Number(b.ordem))
      .map((c) => ({
        ordem: Number(c.ordem),
        status: String(c.status ?? ''),
        lacre: c.lacre != null ? String(c.lacre) : null,
        refrigerado: Boolean(c.refrigerado),
        setPoint: c.setPoint != null && c.setPoint !== '' ? Number(c.setPoint) : null,
      }));

    const riskScore =
      detalhe.resumoRisco?.riscoMax != null && !Number.isNaN(detalhe.resumoRisco.riscoMax)
        ? detalhe.resumoRisco.riscoMax
        : null;

    const gateRows =
      (
        detalhe.solicitacao as unknown as {
          gateCheckIns?: { id: string; checkOut: { id: string } | null }[];
        }
      ).gateCheckIns ?? [];
    const lastGi = gateRows.length ? gateRows[gateRows.length - 1] : null;

    return this.montarPayloadAntifraude({
      solicitacaoId: String(s.id),
      protocolo: String(s.protocolo ?? ''),
      clienteId: String(s.clienteId ?? ''),
      createdAt: (s.createdAt as Date).toISOString(),
      updatedAt: (s.updatedAt as Date).toISOString(),
      tipoCaminhao: ts ? String(ts.tipoCaminhao ?? '') : null,
      containers: containersNorm,
      riskScore,
      fingerprint,
      ultimoGateCheckInId: lastGi?.id ?? null,
      ultimoGateCheckOutId: lastGi?.checkOut?.id ?? null,
    });
  }

  private extrairDadosParaPdf(detalhe: DetalheStaff, fingerprint: string) {
    const s = detalhe.solicitacao as Record<string, unknown>;
    const ts = s.transporteSolicitacao as Record<string, unknown> | undefined;
    const containers = (s.containersSolicitacao as Record<string, unknown>[]) ?? [];
    const ag = s.agendamentoSolicitacao as Record<string, unknown> | undefined;
    const ct = s.solicitanteContato as Record<string, unknown> | undefined;
    const cli = s.cliente as Record<string, unknown> | undefined;
    const anexos = (s.anexosSolicitacao as Record<string, unknown>[]) ?? [];

    const antifraudPayload = this.buildAntifraudPayloadFromDetalhe(detalhe, fingerprint);
    const hash = gerarHashAntiFraude(antifraudPayload);
    return {
      s,
      ts,
      containers,
      ag,
      ct,
      cli,
      anexos,
      timeline: detalhe.timeline,
      securityAlerts: detalhe.securityAlerts,
      auditoria: detalhe.auditoria,
      resumoRisco: detalhe.resumoRisco,
      statusV2Label: detalhe.statusV2Label ?? '',
      antifraudPayload,
      hash,
    };
  }

  async gerarQRCodeDataUrl(verificarUrl: string): Promise<string> {
    return QRCode.toDataURL(verificarUrl, { margin: 1, width: 180, errorCorrectionLevel: 'M' });
  }

  verificarUrlPublica(req: Request, solicitacaoId: string, hash: string): string {
    const base =
      this.config.get<string>('API_PUBLIC_BASE_URL')?.replace(/\/+$/, '') ??
      `${req.protocol}://${req.get('host')}`;
    return `${base}/v2/solicitacoes/${encodeURIComponent(solicitacaoId)}/verificar?hash=${encodeURIComponent(hash)}`;
  }

  async buildHtml(solicitacaoId: string, req: Request): Promise<{ html: string; hash: string }> {
    const detalhe = await this.solicitacoesV2.obterDetalheStaff(solicitacaoId);
    if (!detalhe) throw new NotFoundException('Solicitação v2 não encontrada');

    const fp = String(req.headers['x-device-fingerprint'] ?? '');
    const dados = this.extrairDadosParaPdf(detalhe, fp);
    const verificarUrl = this.verificarUrlPublica(req, solicitacaoId, dados.hash);
    const qrDataUrl = await this.gerarQRCodeDataUrl(verificarUrl);

    await this.redis.setex(
      `v2:pdf:antifraud:${solicitacaoId}:${dados.hash}`,
      PDF_SNAPSHOT_TTL_SEC,
      JSON.stringify(dados.antifraudPayload),
    );

    const tpl = this.loadTemplate();
    const emitidoEm = new Date().toISOString();
    const pdfView = this.viewModelPdf(detalhe, dados);
    const html = tpl({
      logoDataUri: this.resolveLogoDataUri(),
      titulo: 'Comprovante Operacional de Solicitação',
      versaoDoc: '2.0',
      emitidoEm,
      emitidoEmLocal: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      ipEmissao: req.ip ?? req.socket.remoteAddress ?? '',
      fingerprintEmissao: fp || '—',
      qrDataUrl,
      verificarUrl,
      hashAntifraude: dados.hash,
      clienteRazao: dados.cli ? String(dados.cli.razaoSocial ?? dados.cli.nomeFantasia ?? '—') : '—',
      clienteDoc: dados.cli ? String(dados.cli.cpfCnpj ?? '—') : '—',
      securityAlerts: dados.securityAlerts,
      pdfView,
    });
    return { html, hash: dados.hash };
  }

  async generatePdf(html: string): Promise<Buffer> {
    let browser: Browser | undefined;
    try {
      const useLambda = this.config.get<string>('PDF_USE_LAMBDA_CHROMIUM') === '1';
      if (useLambda) {
        const executablePath = await chromium.executablePath();
        browser = await puppeteer.launch({
          args: chromium.args,
          executablePath,
          headless: true,
        });
      } else {
        const executablePath =
          this.config.get<string>('PUPPETEER_EXECUTABLE_PATH') ?? process.env.PUPPETEER_EXECUTABLE_PATH;
        if (!executablePath) {
          throw new ServiceUnavailableException(
            'PDF indisponível: defina PUPPETEER_EXECUTABLE_PATH (Chrome/Chromium) ou PDF_USE_LAMBDA_CHROMIUM=1.',
          );
        }
        browser = await puppeteer.launch({
          executablePath,
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        });
      }
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const buf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '12mm', bottom: '14mm', left: '12mm', right: '12mm' },
      });
      return Buffer.from(buf);
    } catch (e) {
      this.logger.error(`Falha ao gerar PDF: ${(e as Error).message}`);
      if (e instanceof ServiceUnavailableException) throw e;
      throw new ServiceUnavailableException(`Geração de PDF falhou: ${(e as Error).message}`);
    } finally {
      await browser?.close?.();
    }
  }

  async getPdfBuffer(solicitacaoId: string, req: Request): Promise<Buffer> {
    const { html } = await this.buildHtml(solicitacaoId, req);
    return this.generatePdf(html);
  }

  async verificarAuthenticidade(
    solicitacaoId: string,
    hashRecebido: string,
  ): Promise<VerificacaoPdfResult> {
    if (!hashRecebido?.trim()) {
      return {
        valido: false,
        divergencias: [{ campo: 'hash', mensagem: 'Parâmetro hash obrigatório' }],
        riscoMax: null,
        totalAlertas: 0,
      };
    }
    const detalhe = await this.solicitacoesV2.obterDetalheStaff(solicitacaoId);
    if (!detalhe) {
      return {
        valido: false,
        divergencias: [{ campo: 'solicitacao', mensagem: 'Solicitação não encontrada' }],
        riscoMax: null,
        totalAlertas: 0,
      };
    }
    const s = detalhe.solicitacao as Record<string, unknown>;
    const protocolo = String(s.protocolo ?? '');
    const riscoMax = detalhe.resumoRisco?.riscoMax ?? null;
    const totalAlertas = detalhe.resumoRisco?.totalAlertas ?? 0;

    const snapRaw = await this.redis.get(`v2:pdf:antifraud:${solicitacaoId}:${hashRecebido}`);
    let snapFingerprint = '';
    if (snapRaw) {
      try {
        const snap = JSON.parse(snapRaw) as Record<string, unknown>;
        snapFingerprint = String(snap.fingerprint ?? '');
        if (gerarHashAntiFraude(snap) !== hashRecebido) {
          return {
            valido: false,
            divergencias: [{ campo: 'hash', mensagem: 'Snapshot corrompido' }],
            riscoMax,
            totalAlertas,
            protocolo,
          };
        }
        const atual = this.buildAntifraudPayloadFromDetalhe(detalhe, snapFingerprint);
        if (gerarHashAntiFraude(atual) === hashRecebido) {
          return { valido: true, divergencias: [], riscoMax, totalAlertas, protocolo };
        }
        const divergencias = diffAntifraudPayloads(snap, atual).map((d) => ({
          campo: d.campo,
          antes: d.antes,
          depois: d.depois,
        }));
        return { valido: false, divergencias, riscoMax, totalAlertas, protocolo };
      } catch {
        return {
          valido: false,
          divergencias: [{ campo: 'snapshot', mensagem: 'Snapshot inválido' }],
          riscoMax,
          totalAlertas,
          protocolo,
        };
      }
    }

    const atualVazio = this.buildAntifraudPayloadFromDetalhe(detalhe, '');
    if (gerarHashAntiFraude(atualVazio) === hashRecebido) {
      return { valido: true, divergencias: [], riscoMax, totalAlertas, protocolo };
    }

    return {
      valido: false,
      divergencias: [
        {
          campo: 'hash',
          mensagem: 'Hash desconhecido ou snapshot expirado — gere novo PDF para validar',
        },
      ],
      riscoMax,
      totalAlertas,
      protocolo,
    };
  }

  static staffRolesAllowed(): Role[] {
    return STAFF_ROLES_PDF;
  }
}
