import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AcaoAuditoria,
  EtapaCessaoTitularidade,
  OutboxEventStatus,
  Prisma,
  StatusCadastroCliente,
  StatusCessaoTitularidade,
  StatusPagamentoFatura,
} from '@prisma/client';
import { ArmazenagemBillingService } from '../armazenagem-faturamento/armazenagem-billing.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AuthService } from '../auth/auth.service';
import { ObjectStorageService } from '../common/storage/object-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { formatUnidadeProcessoId } from '../unidade-processo/unidade-direcao.util';
import {
  faturaImpedeCessao,
  inferirEtapaCessao,
  nfseJaEmitida,
} from './cessao-titularidade.util';
import type { ExecutarCessaoDto } from './dto/cessao-titularidade.dto';

const CLIENTE_SELECT = {
  id: true,
  razaoSocial: true,
  nomeFantasia: true,
  cpfCnpj: true,
  statusCadastro: true,
} as const;

const COMPROVANTE_MAX = 8 * 1024 * 1024;
const COMPROVANTE_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

@Injectable()
export class CessaoTitularidadeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: ArmazenagemBillingService,
    private readonly auth: AuthService,
    private readonly auditoria: AuditoriaService,
    private readonly storage: ObjectStorageService,
  ) {}

  async autorizarGerente(
    unidadeProcessoId: string,
    documento: string,
    password: string,
    tenantId?: string,
  ) {
    await this.loadProcesso(unidadeProcessoId, tenantId);
    const gerente = await this.auth.verifyGerenteCredentials(tenantId ?? 'default', documento, password);
    return this.auth.issueCessaoSupervisorToken(gerente, unidadeProcessoId);
  }

  async buscarClientes(tenantId: string, q: string, excluirId?: string) {
    const termo = q.trim();
    if (termo.length < 2) return { items: [] as const };
    const digits = termo.replace(/\D/g, '');
    const items = await this.prisma.cliente.findMany({
      where: {
        tenantId,
        deletedAt: null,
        statusCadastro: StatusCadastroCliente.APROVADO,
        ...(excluirId ? { id: { not: excluirId } } : {}),
        OR: [
          { razaoSocial: { contains: termo, mode: 'insensitive' } },
          { nomeFantasia: { contains: termo, mode: 'insensitive' } },
          ...(digits.length >= 3 ? [{ cpfCnpj: { contains: digits } }] : []),
        ],
      },
      select: CLIENTE_SELECT,
      take: 20,
      orderBy: { razaoSocial: 'asc' },
    });
    return { items: items.map((c) => this.mapCliente(c)) };
  }

  async preview(unidadeProcessoId: string, tenantId?: string) {
    const up = await this.loadProcesso(unidadeProcessoId, tenantId);
    const fatura = await this.faturaRelevante(up.id, up.clienteId);
    const etapa = inferirEtapaCessao({
      statusProcesso: up.status,
      fatura,
    });
    const bloqueioPago = faturaImpedeCessao(fatura?.statusPagamento);
    const pendenteNfse = await this.prisma.cessaoTitularidade.findFirst({
      where: {
        unidadeProcessoId: up.id,
        status: StatusCessaoTitularidade.AGUARDANDO_CANCELAMENTO_NFSE,
      },
    });
    const historico = await this.prisma.cessaoTitularidade.findMany({
      where: { unidadeProcessoId: up.id },
      include: {
        deCliente: { select: CLIENTE_SELECT },
        paraCliente: { select: CLIENTE_SELECT },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const pfAberta = await this.prisma.preFatura.findFirst({
      where: { unidadeProcessoId: up.id, status: 'ABERTA' },
      orderBy: { segmento: 'desc' },
      select: { valorAcumulado: true, segmento: true, clienteId: true },
    });

    return {
      unidadeProcessoId: up.id,
      idLabel: formatUnidadeProcessoId(up.numero),
      unidadeIso: up.unidadeIso,
      statusProcesso: up.status,
      etapa,
      bloqueioPago,
      aguardandoCancelamentoNfse: Boolean(pendenteNfse),
      cessaoPendenteId: pendenteNfse?.id ?? null,
      solicitante: this.mapCliente(up.entradaSolicitacao?.cliente ?? up.cliente),
      titular: this.mapCliente(up.cliente),
      fatura: fatura
        ? {
            id: fatura.id,
            valorTotal: Number(fatura.valorTotal),
            statusPagamento: fatura.statusPagamento,
            nfse: nfseJaEmitida(fatura),
            linkNfse: fatura.linkNfse,
            numeroRps: fatura.numeroRps,
          }
        : null,
      preFaturaAberta: pfAberta
        ? { valorAcumulado: Number(pfAberta.valorAcumulado), segmento: pfAberta.segmento }
        : null,
      historico: historico.map((h) => ({
        id: h.id,
        etapa: h.etapa,
        status: h.status,
        motivo: h.motivo,
        vigenteEm: h.vigenteEm.toISOString(),
        de: this.mapCliente(h.deCliente),
        para: this.mapCliente(h.paraCliente),
        valorOrigem: h.valorOrigem != null ? Number(h.valorOrigem) : null,
        comprovante: this.mapComprovante(h),
      })),
      avisos: this.avisosEtapa(etapa, bloqueioPago, Boolean(pendenteNfse)),
    };
  }

  async executar(
    unidadeProcessoId: string,
    body: ExecutarCessaoDto,
    operadorId: string,
    tenantId?: string,
    file?: Express.Multer.File,
  ) {
    if (!body.gerenteToken?.trim()) {
      throw new BadRequestException('Cessão exige autorização de gerente (CPF e senha).');
    }
    const gerente = this.auth.assertCessaoSupervisorToken(body.gerenteToken, unidadeProcessoId);
    const up = await this.loadProcesso(unidadeProcessoId, tenantId);
    if (body.paraClienteId === up.clienteId) {
      throw new BadRequestException('O novo titular já é o titular atual deste ID.');
    }

    const dest = await this.prisma.cliente.findFirst({
      where: {
        id: body.paraClienteId,
        tenantId: up.tenantId,
        deletedAt: null,
        statusCadastro: StatusCadastroCliente.APROVADO,
      },
      select: CLIENTE_SELECT,
    });
    if (!dest) {
      throw new BadRequestException(
        'O cliente destino precisa estar cadastrado, aprovado pelo financeiro e no mesmo tenant.',
      );
    }

    const pendente = await this.prisma.cessaoTitularidade.findFirst({
      where: {
        unidadeProcessoId: up.id,
        status: StatusCessaoTitularidade.AGUARDANDO_CANCELAMENTO_NFSE,
      },
    });
    if (pendente) {
      throw new ConflictException(
        'Já existe uma cessão aguardando cancelamento da NFS-e. Conclua a reemissão no Financeiro.',
      );
    }

    const fatura = await this.faturaRelevante(up.id, up.clienteId);
    if (faturaImpedeCessao(fatura?.statusPagamento)) {
      throw new ConflictException(
        'A fatura deste ID já está paga. Cessão comercial depois do pagamento exige crédito/estorno manual no financeiro.',
      );
    }

    const etapa = inferirEtapaCessao({ statusProcesso: up.status, fatura }) as EtapaCessaoTitularidade;
    const vigenteEm = new Date();
    const comprovante = await this.persistirComprovante(up.id, file);

    return this.prisma.$transaction(async (tx) => {
      const cessao = await tx.cessaoTitularidade.create({
        data: {
          tenantId: up.tenantId,
          unidadeProcessoId: up.id,
          deClienteId: up.clienteId,
          paraClienteId: dest.id,
          etapa,
          status:
            etapa === EtapaCessaoTitularidade.POS_NFSE
              ? StatusCessaoTitularidade.AGUARDANDO_CANCELAMENTO_NFSE
              : StatusCessaoTitularidade.CONCLUIDA,
          motivo: body.motivo.trim(),
          vigenteEm,
          gerenteId: gerente.gerenteId,
          operadorId,
          faturaOrigemId: fatura?.id ?? null,
          comprovanteNome: comprovante.nome,
          comprovanteMime: comprovante.mime,
          comprovanteStorageKey: comprovante.storageKey,
          comprovanteTamanho: comprovante.tamanho,
        },
      });

      await tx.unidadeProcesso.update({
        where: { id: up.id },
        data: { clienteId: dest.id },
      });

      let origemId: string | null = null;
      let destinoId: string | null = null;
      let valorOrigem = 0;
      let faturaDestinoId: string | null = null;

      if (etapa === EtapaCessaoTitularidade.DURANTE_ESTADIA) {
        const xfer = await this.billing.transferOpenPrefaturaOnCessao(tx, {
          unidadeProcessoId: up.id,
          deClienteId: up.clienteId,
          paraClienteId: dest.id,
          cessaoId: cessao.id,
        });
        origemId = xfer.preFaturaId;
        destinoId = xfer.preFaturaId;
        valorOrigem = xfer.valor;
      } else if (etapa === EtapaCessaoTitularidade.POS_SAIDA) {
        const retarget = await this.retargetFaturasPendentes(tx, up.id, up.clienteId, dest.id);
        origemId = retarget.preFaturaId;
        faturaDestinoId = retarget.faturaId;
        valorOrigem = retarget.valor;
      }

      const atualizado = await tx.cessaoTitularidade.update({
        where: { id: cessao.id },
        data: {
          preFaturaOrigemId: origemId,
          preFaturaDestinoId: destinoId,
          faturaDestinoId,
          valorOrigem: valorOrigem ? new Prisma.Decimal(valorOrigem.toFixed(2)) : null,
        },
        include: {
          deCliente: { select: CLIENTE_SELECT },
          paraCliente: { select: CLIENTE_SELECT },
        },
      });

      await this.auditoria.registrar(
        {
          tabela: 'unidade_processos',
          registroId: up.id,
          acao: AcaoAuditoria.UPDATE,
          usuario: gerente.gerenteId,
          solicitacaoId: up.entradaSolicitacaoId ?? undefined,
          dadosAntes: { clienteId: up.clienteId, etapa },
          dadosDepois: {
            clienteId: dest.id,
            cessaoId: cessao.id,
            etapa,
            motivo: body.motivo.trim(),
            operadorId,
            comprovanteNome: comprovante.nome,
          },
        },
        tx,
      );

      return {
        id: atualizado.id,
        etapa: atualizado.etapa,
        status: atualizado.status,
        idLabel: formatUnidadeProcessoId(up.numero),
        de: this.mapCliente(atualizado.deCliente),
        para: this.mapCliente(atualizado.paraCliente),
        vigenteEm: atualizado.vigenteEm.toISOString(),
      };
    });
  }

  async listarPendenciasNfse(tenantId: string) {
    const rows = await this.prisma.cessaoTitularidade.findMany({
      where: {
        tenantId,
        status: StatusCessaoTitularidade.AGUARDANDO_CANCELAMENTO_NFSE,
        etapa: EtapaCessaoTitularidade.POS_NFSE,
      },
      include: {
        unidadeProcesso: {
          select: {
            numero: true,
            unidadeIso: true,
            status: true,
            entradaSolicitacao: { select: { protocolo: true } },
          },
        },
        deCliente: { select: CLIENTE_SELECT },
        paraCliente: { select: CLIENTE_SELECT },
      },
      orderBy: { createdAt: 'asc' },
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        idLabel: formatUnidadeProcessoId(r.unidadeProcesso.numero),
        unidadeIso: r.unidadeProcesso.unidadeIso,
        protocoloEntrada: r.unidadeProcesso.entradaSolicitacao?.protocolo ?? '',
        de: this.mapCliente(r.deCliente),
        para: this.mapCliente(r.paraCliente),
        motivo: r.motivo,
        faturaOrigemId: r.faturaOrigemId,
        vigenteEm: r.vigenteEm.toISOString(),
        comprovante: this.mapComprovante(r),
      })),
    };
  }

  async confirmarReemissao(cessaoId: string, operadorId: string, tenantId?: string, observacao?: string) {
    const cessao = await this.prisma.cessaoTitularidade.findFirst({
      where: { id: cessaoId, ...(tenantId ? { tenantId } : {}) },
    });
    if (!cessao) throw new NotFoundException('Cessão não encontrada.');
    if (cessao.status !== StatusCessaoTitularidade.AGUARDANDO_CANCELAMENTO_NFSE) {
      throw new ConflictException('Esta cessão não está aguardando cancelamento de NFS-e.');
    }
    if (!cessao.faturaOrigemId) {
      throw new ConflictException('Cessão sem fatura de origem para reemitir.');
    }

    const origem = await this.prisma.fatura.findUnique({
      where: { id: cessao.faturaOrigemId },
      include: { preFatura: true },
    });
    if (!origem) throw new NotFoundException('Fatura de origem não encontrada.');
    if (origem.statusPagamento === StatusPagamentoFatura.PAGO) {
      throw new ConflictException('A fatura original foi paga. Não reemita automaticamente.');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.fatura.update({
        where: { id: origem.id },
        data: { statusPagamento: StatusPagamentoFatura.CANCELADO },
      });
      await tx.outboxEvent.updateMany({
        where: {
          aggregateId: origem.id,
          eventType: 'EMITIR_NFSE_BOLETO',
          status: { in: [OutboxEventStatus.PENDING, OutboxEventStatus.FAILED] },
        },
        data: {
          status: OutboxEventStatus.FAILED,
          errorText: 'Cessão de titularidade — NFS-e cancelada; reemissão para novo pagador',
        },
      });

      const clone = await this.billing.clonarPrefaturaParaReemissao(
        tx,
        origem.preFaturaId,
        cessao.paraClienteId,
        cessao.id,
      );

      const atualizado = await tx.cessaoTitularidade.update({
        where: { id: cessao.id },
        data: {
          status: StatusCessaoTitularidade.REEMITIDA,
          preFaturaOrigemId: origem.preFaturaId,
          preFaturaDestinoId: clone.destinoId,
          faturaDestinoId: clone.faturaId,
          valorOrigem: new Prisma.Decimal(clone.valor.toFixed(2)),
        },
      });

      await this.auditoria.registrar(
        {
          tabela: 'cessoes_titularidade',
          registroId: cessao.id,
          acao: AcaoAuditoria.UPDATE,
          usuario: operadorId,
          dadosAntes: { status: cessao.status, faturaOrigemId: origem.id },
          dadosDepois: {
            status: StatusCessaoTitularidade.REEMITIDA,
            faturaDestinoId: clone.faturaId,
            observacao: observacao?.trim() || null,
          },
        },
        tx,
      );

      return {
        id: atualizado.id,
        status: atualizado.status,
        faturaDestinoId: clone.faturaId,
        valor: clone.valor,
      };
    });
  }

  async baixarComprovante(cessaoId: string, tenantId?: string) {
    const cessao = await this.prisma.cessaoTitularidade.findFirst({
      where: { id: cessaoId, ...(tenantId ? { tenantId } : {}) },
      select: {
        comprovanteStorageKey: true,
        comprovanteNome: true,
        comprovanteMime: true,
      },
    });
    if (!cessao?.comprovanteStorageKey) {
      throw new NotFoundException('Esta cessão não tem comprovante anexado.');
    }
    const stored = await this.storage.getBuffer(cessao.comprovanteStorageKey);
    return {
      buffer: stored.buffer,
      mimeType: cessao.comprovanteMime || stored.mimeType || 'application/octet-stream',
      filename: cessao.comprovanteNome || 'comprovante-cessao',
    };
  }

  private async persistirComprovante(
    unidadeProcessoId: string,
    file?: Express.Multer.File,
  ): Promise<{ nome: string; mime: string; storageKey: string; tamanho: number }> {
    if (!file?.buffer?.length) {
      throw new BadRequestException(
        'Anexe o comprovante da solicitação (PDF ou imagem). Sem documento a cessão não é registrada.',
      );
    }
    if (file.size > COMPROVANTE_MAX) {
      throw new BadRequestException('O comprovante não pode passar de 8 MB.');
    }
    const mime = (file.mimetype || '').toLowerCase();
    if (!COMPROVANTE_MIME.has(mime)) {
      throw new BadRequestException('Use PDF, JPG, PNG ou WEBP como comprovante.');
    }
    const nome = (file.originalname || 'comprovante').replace(/[^\w.\- ()áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/g, '_').slice(0, 180);
    const ext =
      mime === 'application/pdf'
        ? '.pdf'
        : mime === 'image/png'
          ? '.png'
          : mime === 'image/webp'
            ? '.webp'
            : '.jpg';
    const safe = nome.toLowerCase().endsWith(ext) ? nome : `${nome}${ext}`;
    const key = `cessao-titularidade/${unidadeProcessoId}/${safe}`;
    const stored = await this.storage.upload({
      key,
      body: file.buffer,
      contentType: mime,
    });
    return {
      nome: safe,
      mime,
      storageKey: stored.storageKey,
      tamanho: file.size,
    };
  }

  private mapComprovante(row: {
    comprovanteNome?: string | null;
    comprovanteMime?: string | null;
    comprovanteTamanho?: number | null;
    comprovanteStorageKey?: string | null;
  }) {
    if (!row.comprovanteStorageKey) return null;
    return {
      nome: row.comprovanteNome || 'comprovante',
      mime: row.comprovanteMime,
      tamanho: row.comprovanteTamanho,
    };
  }

  private avisosEtapa(etapa: string, bloqueioPago: boolean, aguardando: boolean): string[] {
    const avisos: string[] = [];
    if (bloqueioPago) {
      avisos.push('Fatura paga: a cessão automática está bloqueada.');
    }
    if (aguardando) {
      avisos.push('Há uma cessão aguardando o financeiro confirmar o cancelamento da NFS-e.');
    }
    if (etapa === 'DURANTE_ESTADIA') {
      avisos.push(
        'Porta dos fundos: uso excepcional. B assume o ID e toda a conta já provisionada. Na saída sai uma fatura só, em B.',
      );
      avisos.push('Free time e data de entrada continuam os da RIC original. Não existe ciclo novo.');
      avisos.push('O comprovante é obrigatório. A RIC e o solicitante da entrada não mudam.');
    }
    if (etapa === 'POS_SAIDA') {
      avisos.push('O ID já saiu. A fatura pendente (sem NFS-e) inteira passa a ser de B, sem recalcular o valor.');
    }
    if (etapa === 'POS_NFSE') {
      avisos.push(
        'Já existe NFS-e. O financeiro precisa cancelar a nota na prefeitura e confirmar a reemissão para B nesta tela.',
      );
    }
    return avisos;
  }

  private async retargetFaturasPendentes(
    tx: Prisma.TransactionClient,
    unidadeProcessoId: string,
    deClienteId: string,
    paraClienteId: string,
  ): Promise<{ faturaId: string | null; preFaturaId: string | null; valor: number }> {
    const faturas = await tx.fatura.findMany({
      where: {
        clienteId: deClienteId,
        preFatura: { unidadeProcessoId },
        statusPagamento: { notIn: [StatusPagamentoFatura.PAGO, StatusPagamentoFatura.CANCELADO] },
      },
      include: { preFatura: true },
    });
    let last: { faturaId: string; preFaturaId: string; valor: number } | null = null;
    for (const f of faturas) {
      if (nfseJaEmitida(f)) {
        throw new ConflictException(
          'Há NFS-e emitida nesta fatura. Use o fluxo pós-NFS-e (cancelamento + reemissão).',
        );
      }
      const processing = await tx.outboxEvent.findFirst({
        where: {
          aggregateId: f.id,
          eventType: 'EMITIR_NFSE_BOLETO',
          status: OutboxEventStatus.PROCESSING,
        },
      });
      if (processing) {
        throw new ConflictException(
          'A emissão da NFS-e está em andamento. Aguarde o término ou cancele no financeiro antes de ceder.',
        );
      }
      await tx.fatura.update({
        where: { id: f.id },
        data: { clienteId: paraClienteId },
      });
      await tx.preFatura.update({
        where: { id: f.preFaturaId },
        data: { clienteId: paraClienteId },
      });
      const pending = await tx.outboxEvent.findMany({
        where: {
          aggregateId: f.id,
          eventType: 'EMITIR_NFSE_BOLETO',
          status: { in: [OutboxEventStatus.PENDING, OutboxEventStatus.FAILED] },
        },
      });
      for (const ev of pending) {
        const payload =
          ev.payload && typeof ev.payload === 'object' && !Array.isArray(ev.payload)
            ? { ...(ev.payload as Record<string, unknown>), clienteId: paraClienteId }
            : { clienteId: paraClienteId, faturaId: f.id };
        await tx.outboxEvent.update({
          where: { id: ev.id },
          data: { payload: payload as Prisma.InputJsonValue },
        });
      }
      last = { faturaId: f.id, preFaturaId: f.preFaturaId, valor: Number(f.valorTotal) };
    }
    return last ?? { faturaId: null, preFaturaId: null, valor: 0 };
  }

  private async faturaRelevante(unidadeProcessoId: string, clienteId: string) {
    return this.prisma.fatura.findFirst({
      where: { clienteId, preFatura: { unidadeProcessoId } },
      orderBy: { dataEmissao: 'desc' },
      select: {
        id: true,
        valorTotal: true,
        statusPagamento: true,
        linkNfse: true,
        numeroRps: true,
      },
    });
  }

  private async loadProcesso(id: string, tenantId?: string) {
    const up = await this.prisma.unidadeProcesso.findFirst({
      where: { id, ...(tenantId ? { tenantId } : {}) },
      include: {
        cliente: { select: CLIENTE_SELECT },
        entradaSolicitacao: { select: { id: true, protocolo: true, cliente: { select: CLIENTE_SELECT } } },
      },
    });
    if (!up) throw new NotFoundException('ID operacional não encontrado.');
    return up;
  }

  private mapCliente(c: {
    id: string;
    razaoSocial: string;
    nomeFantasia: string | null;
    cpfCnpj: string;
    statusCadastro?: string;
  }) {
    return {
      id: c.id,
      nome: c.nomeFantasia?.trim() || c.razaoSocial,
      razaoSocial: c.razaoSocial,
      cpfCnpj: c.cpfCnpj,
    };
  }
}
