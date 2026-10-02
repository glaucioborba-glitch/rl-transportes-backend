import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StatusPagamentoFatura } from '@prisma/client';
import { ObjectStorageService } from '../common/storage/object-storage.service';
import {
  competenciaAtual,
  competenciaMesAnterior,
  cronPodeFechar,
  previaPodeGravar,
  simularEncargos,
  type EncargosGeradoPor,
  type EncargosResultado,
} from './empresa-encargos.util';
import type { SimularEncargosDto } from './dto/simular-encargos.dto';
import { PrismaService } from '../prisma/prisma.service';
import {
  CLIENTE_LOGO_SPEC,
  EMPRESA_LOGO_SLOTS,
  fallbackSlotChain,
  isEmpresaLogoSlot,
  readImageSize,
  specForSlot,
  type EmpresaLogoMeta,
  type EmpresaLogoSlot,
} from './empresa-logo.util';
import {
  DEFAULT_EMPRESA_OPERADORA,
  mergeEmpresaOperadora,
  type EmpresaOperadoraDados,
} from './empresa-operadora.types';
import type { UpdateEmpresaOperadoraDto } from './dto/update-empresa-operadora.dto';
import { DEFAULT_TENANT_ID } from './tenant.constants';
import { parseIdiomaPadrao, parseMoedaCorrente } from './tenant-locale.util';

type ClienteLogosMap = Record<string, EmpresaLogoMeta>;

@Injectable()
export class EmpresaOperadoraService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
    private readonly config: ConfigService,
  ) {}

  async obter(tenantId = DEFAULT_TENANT_ID) {
    const { tenant, row } = await this.loadRow(tenantId);
    const dados = mergeEmpresaOperadora(
      this.readEmpresaJson(row?.parametros),
      tenant?.nome ?? row?.nome ?? 'RL Transportes',
    );
    if (!dados.razaoSocial && tenant?.nome) dados.razaoSocial = tenant.nome;
    if (!dados.nomeFantasia && tenant?.nome) dados.nomeFantasia = tenant.nome;
    const moedaCorrente = parseMoedaCorrente(tenant?.moedaCorrente);
    const idiomaPadrao = parseIdiomaPadrao(tenant?.idiomaPadrao);
    return {
      tenantId: tenant?.id ?? tenantId,
      tenantNome: tenant?.nome ?? dados.nomeFantasia,
      ...dados,
      moedaCorrente,
      idiomaPadrao,
      logos: this.mapLogosWithUrl(dados.logos),
      slots: EMPRESA_LOGO_SLOTS.map((s) => ({
        slot: s.slot,
        titulo: s.titulo,
        ondeAparece: s.ondeAparece,
        descricao: s.descricao,
        formatos: s.formatos,
        dimensoes: s.dimensoes,
        tamanhoMax: s.tamanhoMax,
      })),
      clienteLogoSpec: {
        titulo: CLIENTE_LOGO_SPEC.titulo,
        ondeAparece: CLIENTE_LOGO_SPEC.ondeAparece,
        descricao: CLIENTE_LOGO_SPEC.descricao,
        formatos: CLIENTE_LOGO_SPEC.formatos,
        dimensoes: CLIENTE_LOGO_SPEC.dimensoes,
        tamanhoMax: CLIENTE_LOGO_SPEC.tamanhoMax,
      },
      encargosHistorico: this.readEncargosHistorico(row?.parametros),
    };
  }

  async atualizar(tenantId: string, dto: UpdateEmpresaOperadoraDto) {
    const { tenant, row } = await this.loadRow(tenantId);
    if (!row) throw new NotFoundException('Configuração do tenant não encontrada.');
    const atual = mergeEmpresaOperadora(this.readEmpresaJson(row.parametros), tenant?.nome ?? row.nome);
    const next: EmpresaOperadoraDados = {
      ...atual,
      ...this.normalizePatch(dto),
      logos: atual.logos,
      moedaCorrente: parseMoedaCorrente(tenant?.moedaCorrente),
    };
    const parametros = this.asRecord(row.parametros);
    parametros.empresa = next;
    const nomeExibicao = next.nomeFantasia || next.razaoSocial || tenant?.nome || row.nome;
    await this.prisma.$transaction([
      this.prisma.tenantConfig.update({
        where: { id: row.id },
        data: { parametros: parametros as object, nome: nomeExibicao.slice(0, 255) },
      }),
      this.prisma.tenant.update({
        where: { id: row.tenantId },
        data: { nome: nomeExibicao.slice(0, 255) },
      }),
    ]);
    return this.obter(row.tenantId);
  }

  async uploadLogo(tenantId: string, slotRaw: string, file?: Express.Multer.File) {
    if (!isEmpresaLogoSlot(slotRaw)) {
      throw new BadRequestException('Tipo de logo inválido.');
    }
    const spec = specForSlot(slotRaw);
    const meta = this.validarArquivo(file, spec);
    const { tenant, row } = await this.loadRow(tenantId);
    if (!row) throw new NotFoundException('Configuração do tenant não encontrada.');
    const atual = mergeEmpresaOperadora(this.readEmpresaJson(row.parametros), tenant?.nome ?? row.nome);
    const ext = this.extFromMime(meta.mime);
    const key = `empresa-marca/${row.tenantId}/${slotRaw}${ext}`;
    const stored = await this.storage.upload({
      key,
      body: file!.buffer,
      contentType: meta.mime,
    });
    const anterior = atual.logos[slotRaw];
    atual.logos[slotRaw] = {
      storageKey: stored.storageKey,
      mime: meta.mime,
      nome: meta.nome,
      tamanho: meta.tamanho,
      width: meta.width,
      height: meta.height,
      atualizadoEm: new Date().toISOString(),
    };
    const parametros = this.asRecord(row.parametros);
    parametros.empresa = atual;
    await this.prisma.tenantConfig.update({
      where: { id: row.id },
      data: { parametros: parametros as object },
    });
    if (anterior?.storageKey && anterior.storageKey !== stored.storageKey) {
      await this.storage.deleteKeys([anterior.storageKey], 'empresa-marca');
    }
    return this.obter(row.tenantId);
  }

  async removerLogo(tenantId: string, slotRaw: string) {
    if (!isEmpresaLogoSlot(slotRaw)) {
      throw new BadRequestException('Tipo de logo inválido.');
    }
    const { tenant, row } = await this.loadRow(tenantId);
    if (!row) throw new NotFoundException('Configuração do tenant não encontrada.');
    const atual = mergeEmpresaOperadora(this.readEmpresaJson(row.parametros), tenant?.nome ?? row.nome);
    const anterior = atual.logos[slotRaw];
    if (!anterior) return this.obter(row.tenantId);
    delete atual.logos[slotRaw];
    const parametros = this.asRecord(row.parametros);
    parametros.empresa = atual;
    await this.prisma.tenantConfig.update({
      where: { id: row.id },
      data: { parametros: parametros as object },
    });
    await this.storage.deleteKeys([anterior.storageKey], 'empresa-marca');
    return this.obter(row.tenantId);
  }

  async brandingPublico(tenantId = DEFAULT_TENANT_ID) {
    const out = await this.obter(tenantId);
    return {
      tenantId: out.tenantId,
      nome: out.nomeFantasia || out.razaoSocial,
      razaoSocial: out.razaoSocial,
      moedaCorrente: out.moedaCorrente,
      idiomaPadrao: out.idiomaPadrao,
      logos: out.logos,
    };
  }

  async lerLogo(
    tenantId: string,
    slotRaw: string,
  ): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
    if (!isEmpresaLogoSlot(slotRaw)) {
      throw new NotFoundException();
    }
    const { tenant, row } = await this.loadRow(tenantId);
    const dados = mergeEmpresaOperadora(this.readEmpresaJson(row?.parametros), tenant?.nome ?? '');
    for (const slot of fallbackSlotChain(slotRaw)) {
      const meta = dados.logos[slot];
      if (!meta?.storageKey) continue;
      const stored = await this.storage.getBuffer(meta.storageKey);
      return {
        buffer: stored.buffer,
        mimeType: meta.mime || stored.mimeType || 'image/png',
        filename: meta.nome || `${slot}.png`,
      };
    }
    throw new NotFoundException();
  }

  async logoDataUri(tenantId: string, slot: EmpresaLogoSlot = 'documento'): Promise<string | null> {
    try {
      const file = await this.lerLogo(tenantId, slot);
      return `data:${file.mimeType};base64,${file.buffer.toString('base64')}`;
    } catch {
      return null;
    }
  }

  async logoPngBuffer(tenantId: string, slot: EmpresaLogoSlot = 'documento'): Promise<Buffer | null> {
    try {
      const file = await this.lerLogo(tenantId, slot);
      if (file.mimeType.includes('svg')) return null;
      return file.buffer;
    } catch {
      return null;
    }
  }

  async uploadClienteLogo(tenantId: string, clienteId: string, file?: Express.Multer.File) {
    await this.assertCliente(tenantId, clienteId);
    const meta = this.validarArquivo(file, {
      maxBytes: CLIENTE_LOGO_SPEC.maxBytes,
      mimes: CLIENTE_LOGO_SPEC.mimes,
      allowSvg: true,
      minLado: CLIENTE_LOGO_SPEC.minLado,
      maxLargura: CLIENTE_LOGO_SPEC.maxLargura,
      maxAltura: CLIENTE_LOGO_SPEC.maxAltura,
      titulo: CLIENTE_LOGO_SPEC.titulo,
    });
    const { row } = await this.loadRow(tenantId);
    if (!row) throw new NotFoundException('Configuração do tenant não encontrada.');
    const map = this.readClienteLogos(row.parametros);
    const ext = this.extFromMime(meta.mime);
    const stored = await this.storage.upload({
      key: `empresa-marca/${row.tenantId}/clientes/${clienteId}${ext}`,
      body: file!.buffer,
      contentType: meta.mime,
    });
    const anterior = map[clienteId];
    map[clienteId] = {
      storageKey: stored.storageKey,
      mime: meta.mime,
      nome: meta.nome,
      tamanho: meta.tamanho,
      width: meta.width,
      height: meta.height,
      atualizadoEm: new Date().toISOString(),
    };
    const parametros = this.asRecord(row.parametros);
    parametros.clienteLogos = map;
    await this.prisma.tenantConfig.update({
      where: { id: row.id },
      data: { parametros: parametros as object },
    });
    if (anterior?.storageKey && anterior.storageKey !== stored.storageKey) {
      await this.storage.deleteKeys([anterior.storageKey], 'empresa-marca');
    }
    return this.clienteLogoView(clienteId, map[clienteId]);
  }

  async removerClienteLogo(tenantId: string, clienteId: string) {
    const { row } = await this.loadRow(tenantId);
    if (!row) throw new NotFoundException('Configuração do tenant não encontrada.');
    const map = this.readClienteLogos(row.parametros);
    const anterior = map[clienteId];
    if (!anterior) return { ok: true };
    delete map[clienteId];
    const parametros = this.asRecord(row.parametros);
    parametros.clienteLogos = map;
    await this.prisma.tenantConfig.update({
      where: { id: row.id },
      data: { parametros: parametros as object },
    });
    await this.storage.deleteKeys([anterior.storageKey], 'empresa-marca');
    return { ok: true };
  }

  async obterClienteLogoMeta(tenantId: string, clienteId: string) {
    const { row } = await this.loadRow(tenantId);
    const meta = this.readClienteLogos(row?.parametros)[clienteId];
    return meta ? this.clienteLogoView(clienteId, meta) : null;
  }

  async lerClienteLogo(tenantId: string, clienteId: string) {
    const { row } = await this.loadRow(tenantId);
    const meta = this.readClienteLogos(row?.parametros)[clienteId];
    if (!meta?.storageKey) throw new NotFoundException();
    const stored = await this.storage.getBuffer(meta.storageKey);
    return {
      buffer: stored.buffer,
      mimeType: meta.mime || stored.mimeType || 'image/png',
      filename: meta.nome || 'logo-cliente.png',
    };
  }

  async simularEncargos(
    tenantId: string,
    dto: SimularEncargosDto,
    opts?: { geradoPor?: EncargosGeradoPor; parcial?: boolean },
  ) {
    const { tenant, row } = await this.loadRow(tenantId);
    const dados = mergeEmpresaOperadora(this.readEmpresaJson(row?.parametros), tenant?.nome ?? '');
    const periodo = this.resolvePeriodo(dto);
    const faturada = await this.receitaFaturada(row?.tenantId ?? tenantId, periodo.inicio, periodo.fim);
    const origem: 'MANUAL' | 'FATURAS' =
      dto.receitaManual != null && Number.isFinite(dto.receitaManual) ? 'MANUAL' : 'FATURAS';
    const receita = origem === 'MANUAL' ? Number(dto.receitaManual) : faturada.total;
    const resultado = simularEncargos({
      regime: dados.regimeTributario,
      receita,
      aliquotaIss: dados.aliquotaIss,
      aliquotaPis: dados.aliquotaPis,
      aliquotaCofins: dados.aliquotaCofins,
      aliquotaCsll: dados.aliquotaCsll,
      aliquotaIrpj: dados.aliquotaIrpj,
      simplesAnexo: dados.simplesAnexo,
    });
    const avisos = [...resultado.avisos];
    if (opts?.parcial) {
      avisos.push(
        'Prévia do mês em curso: considera só as faturas já emitidas. O fechamento automático do dia 1 substitui esta prévia.',
      );
    }
    const snapshot = {
      ...resultado,
      avisos,
      id: `${periodo.competencia}-${Date.now()}`,
      competencia: periodo.competencia,
      dataInicio: periodo.inicio.toISOString().slice(0, 10),
      dataFim: periodo.fim.toISOString().slice(0, 10),
      origemReceita: origem,
      receitaFaturada: faturada.total,
      qtdFaturas: faturada.quantidade,
      empresa: dados.nomeFantasia || dados.razaoSocial,
      simuladoEm: new Date().toISOString(),
      status: 'PROVISAO' as const,
      geradoPor: opts?.geradoPor ?? 'USUARIO',
      parcial: Boolean(opts?.parcial),
    };
    let historico = this.readEncargosHistorico(row?.parametros);
    if (dto.salvar) {
      if (!row) throw new NotFoundException('Configuração do tenant não encontrada.');
      historico = [snapshot, ...historico.filter((h) => h.competencia !== periodo.competencia)].slice(0, 18);
      const parametros = this.asRecord(row.parametros);
      parametros.empresaEncargosHistorico = historico;
      await this.prisma.tenantConfig.update({
        where: { id: row.id },
        data: { parametros: parametros as object },
      });
    }
    return { ...snapshot, historico };
  }

  async listarEncargos(tenantId: string) {
    const { row } = await this.loadRow(tenantId);
    return { items: this.readEncargosHistorico(row?.parametros) };
  }

  /**
   * Fecha a competência do mês anterior com as faturas reais.
   * Não sobrescreve se o financeiro já gravou aquele mês.
   */
  async gerarProvisaoAutomaticaMesAnterior(tenantId: string, ref: Date = new Date()) {
    const competencia = competenciaMesAnterior(ref);
    const { row } = await this.loadRow(tenantId);
    const historico = this.readEncargosHistorico(row?.parametros);
    const existente = historico.find((h) => h.competencia === competencia);
    if (!cronPodeFechar(existente)) {
      return { skipped: true, competencia, motivo: 'ja_gravada' as const };
    }
    const out = await this.simularEncargos(tenantId, { competencia, salvar: true }, { geradoPor: 'CRON' });
    return { skipped: false, competencia, total: out.total, qtdFaturas: out.qtdFaturas };
  }

  /** Prévia do mês corrente com as faturas já emitidas — pode rodar em qualquer dia. */
  async gerarPreviaMesCorrente(tenantId: string, ref: Date = new Date()) {
    const competencia = competenciaAtual(ref);
    const { row } = await this.loadRow(tenantId);
    const historico = this.readEncargosHistorico(row?.parametros);
    const existente = historico.find((h) => h.competencia === competencia);
    if (!previaPodeGravar(existente)) {
      return {
        ...existente,
        skipped: true as const,
        motivo: 'ja_fechada' as const,
        historico,
      };
    }
    const out = await this.simularEncargos(
      tenantId,
      { competencia, salvar: true },
      { geradoPor: 'PREVIA', parcial: true },
    );
    return { ...out, skipped: false as const };
  }

  private async receitaFaturada(tenantId: string, inicio: Date, fim: Date) {
    const rows = await this.prisma.fatura.findMany({
      where: {
        tenantId,
        dataEmissao: { gte: inicio, lte: fim },
        statusPagamento: { not: StatusPagamentoFatura.CANCELADO },
      },
      select: { valorTotal: true },
    });
    const total = Math.round(rows.reduce((s, r) => s + Number(r.valorTotal), 0) * 100) / 100;
    return { total, quantidade: rows.length };
  }

  private resolvePeriodo(dto: SimularEncargosDto): { competencia: string; inicio: Date; fim: Date } {
    const now = new Date();
    const competencia =
      dto.competencia?.trim() ||
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (dto.dataInicio && dto.dataFim) {
      const inicio = new Date(`${dto.dataInicio}T00:00:00.000`);
      const fim = new Date(`${dto.dataFim}T23:59:59.999`);
      if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime()) || inicio > fim) {
        throw new BadRequestException('Período inválido.');
      }
      return { competencia, inicio, fim };
    }
    const [y, m] = competencia.split('-').map((x) => parseInt(x, 10));
    const inicio = new Date(y, m - 1, 1, 0, 0, 0, 0);
    const fim = new Date(y, m, 0, 23, 59, 59, 999);
    return { competencia, inicio, fim };
  }

  private readEncargosHistorico(parametros: unknown): Array<
    EncargosResultado & {
      id: string;
      competencia: string;
      dataInicio: string;
      dataFim: string;
      origemReceita: 'MANUAL' | 'FATURAS';
      receitaFaturada: number;
      qtdFaturas: number;
      empresa: string;
      simuladoEm: string;
      status: 'PROVISAO';
      geradoPor?: EncargosGeradoPor;
      parcial?: boolean;
    }
  > {
    if (!parametros || typeof parametros !== 'object') return [];
    const raw = (parametros as { empresaEncargosHistorico?: unknown }).empresaEncargosHistorico;
    return Array.isArray(raw) ? (raw as never) : [];
  }

  logoPublicUrl(slot: EmpresaLogoSlot, version?: string): string {
    const base = this.publicApiBase();
    const q = version ? `?v=${encodeURIComponent(version)}` : '';
    return `${base}/public/empresa/logo/${slot}${q}`;
  }

  clienteLogoPublicUrl(clienteId: string, version?: string): string {
    const base = this.publicApiBase();
    const q = version ? `?v=${encodeURIComponent(version)}` : '';
    return `${base}/public/empresa/cliente-logo/${encodeURIComponent(clienteId)}${q}`;
  }

  private async loadRow(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, nome: true, moedaCorrente: true, idiomaPadrao: true },
    });
    const row = await this.prisma.tenantConfig.findFirst({
      where: { OR: [{ tenantId }, { tenantKey: tenantId }] },
    });
    return { tenant, row };
  }

  private readEmpresaJson(parametros: unknown): unknown {
    if (!parametros || typeof parametros !== 'object') return undefined;
    return (parametros as { empresa?: unknown }).empresa;
  }

  private readClienteLogos(parametros: unknown): ClienteLogosMap {
    if (!parametros || typeof parametros !== 'object') return {};
    const raw = (parametros as { clienteLogos?: unknown }).clienteLogos;
    if (!raw || typeof raw !== 'object') return {};
    return { ...(raw as ClienteLogosMap) };
  }

  private asRecord(parametros: unknown): Record<string, unknown> {
    if (parametros && typeof parametros === 'object' && !Array.isArray(parametros)) {
      return { ...(parametros as Record<string, unknown>) };
    }
    return {};
  }

  private mapLogosWithUrl(logos: EmpresaOperadoraDados['logos']) {
    const out: Record<string, EmpresaLogoMeta & { url: string }> = {};
    for (const spec of EMPRESA_LOGO_SLOTS) {
      const meta = logos[spec.slot];
      if (!meta) continue;
      out[spec.slot] = { ...meta, url: this.logoPublicUrl(spec.slot, meta.atualizadoEm) };
    }
    return out;
  }

  private clienteLogoView(clienteId: string, meta: EmpresaLogoMeta) {
    return {
      ...meta,
      clienteId,
      url: this.clienteLogoPublicUrl(clienteId, meta.atualizadoEm),
    };
  }

  private publicApiBase(): string {
    return (
      this.config.get<string>('API_PUBLIC_BASE_URL') ??
      process.env.API_PUBLIC_BASE_URL ??
      this.config.get<string>('PUBLIC_API_URL') ??
      process.env.PUBLIC_API_URL ??
      `http://localhost:${process.env.API_PORT ?? '3001'}`
    ).replace(/\/$/, '');
  }

  private async assertCliente(tenantId: string, clienteId: string) {
    const c = await this.prisma.cliente.findFirst({
      where: { id: clienteId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!c) throw new NotFoundException('Cliente não encontrado.');
  }

  private normalizePatch(dto: UpdateEmpresaOperadoraDto): Partial<EmpresaOperadoraDados> {
    const out: Partial<EmpresaOperadoraDados> = {};
    const str = (v?: string) => (v == null ? undefined : v.trim());
    if (dto.razaoSocial !== undefined) out.razaoSocial = str(dto.razaoSocial) ?? '';
    if (dto.nomeFantasia !== undefined) out.nomeFantasia = str(dto.nomeFantasia) ?? '';
    if (dto.cnpj !== undefined) out.cnpj = dto.cnpj.replace(/\D/g, '').slice(0, 14);
    if (dto.inscricaoEstadual !== undefined) out.inscricaoEstadual = str(dto.inscricaoEstadual) ?? '';
    if (dto.inscricaoMunicipal !== undefined) out.inscricaoMunicipal = str(dto.inscricaoMunicipal) ?? '';
    if (dto.cnae !== undefined) out.cnae = String(dto.cnae).replace(/\D/g, '').slice(0, 7);
    if (dto.telefone !== undefined) out.telefone = str(dto.telefone) ?? '';
    if (dto.email !== undefined) out.email = str(dto.email) ?? '';
    if (dto.emailNf !== undefined) out.emailNf = str(dto.emailNf) ?? '';
    if (dto.emailFinanceiro !== undefined) out.emailFinanceiro = str(dto.emailFinanceiro) ?? '';
    if (dto.site !== undefined) out.site = str(dto.site) ?? '';
    if (dto.cep !== undefined) out.cep = dto.cep.replace(/\D/g, '').slice(0, 8);
    if (dto.logradouro !== undefined) out.logradouro = str(dto.logradouro) ?? '';
    if (dto.numero !== undefined) out.numero = str(dto.numero) ?? '';
    if (dto.complemento !== undefined) out.complemento = str(dto.complemento) ?? '';
    if (dto.bairro !== undefined) out.bairro = str(dto.bairro) ?? '';
    if (dto.cidade !== undefined) out.cidade = str(dto.cidade) ?? '';
    if (dto.uf !== undefined) out.uf = (str(dto.uf) ?? '').toUpperCase().slice(0, 2);
    if (dto.regimeTributario !== undefined) out.regimeTributario = dto.regimeTributario;
    if (dto.simplesAnexo !== undefined) out.simplesAnexo = str(dto.simplesAnexo) ?? '';
    if (dto.aliquotaIss !== undefined) out.aliquotaIss = dto.aliquotaIss;
    if (dto.aliquotaPis !== undefined) out.aliquotaPis = dto.aliquotaPis;
    if (dto.aliquotaCofins !== undefined) out.aliquotaCofins = dto.aliquotaCofins;
    if (dto.aliquotaCsll !== undefined) out.aliquotaCsll = dto.aliquotaCsll;
    if (dto.aliquotaIrpj !== undefined) out.aliquotaIrpj = dto.aliquotaIrpj;
    return out;
  }

  private validarArquivo(
    file: Express.Multer.File | undefined,
    spec: {
      maxBytes: number;
      mimes: readonly string[];
      allowSvg: boolean;
      minLado?: number;
      maxLargura?: number;
      maxAltura?: number;
      quadrado?: boolean;
      titulo: string;
    },
  ): { mime: string; nome: string; tamanho: number; width: number | null; height: number | null } {
    if (!file?.buffer?.length) {
      throw new BadRequestException(`Envie um arquivo para ${spec.titulo.toLowerCase()}.`);
    }
    const mime = (file.mimetype || '').toLowerCase();
    if (!spec.mimes.includes(mime)) {
      throw new BadRequestException(`Formato inválido para ${spec.titulo}. Use ${spec.mimes.join(', ')}.`);
    }
    if (file.size > spec.maxBytes) {
      throw new BadRequestException(
        `${spec.titulo}: o arquivo passa de ${(spec.maxBytes / 1024).toFixed(0)} KB.`,
      );
    }
    const size = readImageSize(file.buffer, mime);
    if (mime !== 'image/svg+xml') {
      if (!size) {
        throw new BadRequestException('Não foi possível ler as dimensões da imagem.');
      }
      if (spec.quadrado && Math.abs(size.width - size.height) > 8) {
        throw new BadRequestException('O ícone precisa ser quadrado (mesma largura e altura).');
      }
      if (spec.minLado && (size.width < spec.minLado || size.height < spec.minLado)) {
        throw new BadRequestException(
          `${spec.titulo}: mínimo ${spec.minLado} px no menor lado (enviado ${size.width}×${size.height}).`,
        );
      }
      if (spec.maxLargura && size.width > spec.maxLargura) {
        throw new BadRequestException(`${spec.titulo}: largura máxima ${spec.maxLargura} px.`);
      }
      if (spec.maxAltura && size.height > spec.maxAltura) {
        throw new BadRequestException(`${spec.titulo}: altura máxima ${spec.maxAltura} px.`);
      }
    }
    const nome = (file.originalname || 'logo')
      .replace(/[^\w.\- ()áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/g, '_')
      .slice(0, 160);
    return {
      mime,
      nome,
      tamanho: file.size,
      width: size?.width ?? null,
      height: size?.height ?? null,
    };
  }

  private extFromMime(mime: string): string {
    if (mime === 'image/png') return '.png';
    if (mime === 'image/webp') return '.webp';
    if (mime === 'image/svg+xml') return '.svg';
    return '.jpg';
  }
}

export { DEFAULT_EMPRESA_OPERADORA };
