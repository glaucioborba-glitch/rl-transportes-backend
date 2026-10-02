import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, StatusContainer, StatusContainerTarifa, StatusUnidadeProcesso } from '@prisma/client';
import { ArmazenagemBillingService } from '../armazenagem-faturamento/armazenagem-billing.service';
import {
  appendLinhaObservacaoEfeito,
  appendObservacao,
  separarObservacaoLivreEEfeitos,
  linhaObservacaoTransbordo,
  linhaObservacaoTrocaLacre,
  observacaoLacreRic,
  parseEfeitoConfig,
  parseOrigemLacre,
  parseServicoEfeito,
  PATIO_STATUS_ARMAZENADA,
  type ServicoEfeitoPayload,
  type LancarServicoEfeitoInput,
} from '../cadastros/servico-efeito';
import { stripContainerIsoCanonical } from '../common/utils/data-sanitize';
import { isValidIso6346 } from '../common/utils/iso6346';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ServicoEfeitoAplicarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: ArmazenagemBillingService,
  ) {}

  async aplicar(params: {
    processoId: string;
    item: { id: string; tabelaId: string; codigo: string; nome: string; efeito?: string; efeitoConfig?: unknown };
    input: LancarServicoEfeitoInput;
  }): Promise<{ payload: ServicoEfeitoPayload; linhasExtras: Prisma.UnidadeProcessoServicoCreateManyInput[] }> {
    const efeito = parseServicoEfeito(params.item.efeito);
    const config = parseEfeitoConfig(params.item.efeitoConfig);
    if (efeito === 'NENHUM') return { payload: { efeito }, linhasExtras: [] };

    if (efeito === 'SUBSTITUIR_LACRE_SAIDA') {
      return this.aplicarLacreSaida(params.processoId, params.item, params.input, config);
    }
    return this.aplicarTransbordo(params.processoId, params.item, params.input);
  }

  /** Desfaz lacre/transbordo ao excluir o lançamento (ID ainda aberto). */
  async reverter(processoId: string, payload: ServicoEfeitoPayload): Promise<void> {
    const efeito = parseServicoEfeito(payload.efeito);
    if (efeito === 'NENHUM') return;

    if (efeito === 'SUBSTITUIR_LACRE_SAIDA') {
      const processo = await this.prisma.unidadeProcesso.findUnique({
        where: { id: processoId },
        select: {
          lacreSaida: true,
          entradaSolicitacaoId: true,
          saidaSolicitacaoId: true,
        },
      });
      await this.appendObservacaoSolicitacao(
        processo?.entradaSolicitacaoId,
        `Desfeito: troca de lacre${payload.lacre ? ` (${payload.lacre})` : ''}.`,
      );
      await this.appendObservacaoSolicitacao(
        processo?.saidaSolicitacaoId,
        `Desfeito: troca de lacre${payload.lacre ? ` (${payload.lacre})` : ''}.`,
      );
      await this.prisma.unidadeProcesso.update({
        where: { id: processoId },
        data: { lacreSaida: null, lacreSaidaOrigem: null, lacreSaidaObservacao: null },
      });
      return;
    }

    const destId = payload.unidadeProcessoDestinoId;
    const origem = await this.prisma.unidadeProcesso.findUnique({ where: { id: processoId } });
    if (!origem || !destId) return;
    const destino = await this.prisma.unidadeProcesso.findUnique({ where: { id: destId } });
    if (!destino) return;

    await this.gravarStatusOperacional(origem.id, origem.unidadeIso, 'CHEIO');
    await this.gravarStatusOperacional(destino.id, destino.unidadeIso, 'VAZIO');
    await this.appendObservacaoSolicitacao(
      origem.entradaSolicitacaoId,
      `Desfeito: transbordo para ${payload.isoDestino ?? destino.unidadeIso}.`,
    );
    await this.appendObservacaoSolicitacao(
      destino.entradaSolicitacaoId,
      `Desfeito: transbordo a partir de ${origem.unidadeIso}.`,
    );
    await this.prisma.unidadeProcesso.update({
      where: { id: origem.id },
      data: { faturarHandlingComoCheio: false },
    });
    await this.prisma.unidadeProcesso.update({
      where: { id: destino.id },
      data: {
        faturarHandlingComoCheio: false,
        ...(payload.lacre
          ? { lacreSaida: null, lacreSaidaObservacao: null }
          : {}),
      },
    });
  }

  private async aplicarLacreSaida(
    processoId: string,
    item: { tabelaId: string; nome: string },
    input: LancarServicoEfeitoInput,
    config: ReturnType<typeof parseEfeitoConfig>,
  ) {
    const origem = parseOrigemLacre(input.origemLacre)!;
    const lacre = String(input.lacre ?? '').trim();
    const processo = await this.prisma.unidadeProcesso.findUnique({
      where: { id: processoId },
      select: {
        unidadeIso: true,
        lacreSaida: true,
        lacreSaidaObservacao: true,
        entradaSolicitacaoId: true,
        saidaSolicitacaoId: true,
      },
    });
    const lacreAnterior = await this.lacreAtualDoProcesso(processo);
    const linha = linhaObservacaoTrocaLacre({
      servico: item.nome,
      anterior: lacreAnterior,
      atual: lacre,
      origem,
    });
    const observacaoRic =
      appendObservacao(processo?.lacreSaidaObservacao, linha, 255) || observacaoLacreRic(item.nome, config);
    await this.prisma.unidadeProcesso.update({
      where: { id: processoId },
      data: {
        lacreSaida: lacre,
        lacreSaidaOrigem: origem,
        lacreSaidaObservacao: observacaoRic,
      },
    });
    await this.appendObservacaoSolicitacao(processo?.entradaSolicitacaoId, linha);
    await this.appendObservacaoSolicitacao(processo?.saidaSolicitacaoId, linha);

    const linhasExtras: Prisma.UnidadeProcessoServicoCreateManyInput[] = [];
    if (origem === 'TERMINAL' && config.servicoLacreTerminalCodigo) {
      const cobrado = await this.prisma.cadastroServicoItem.findFirst({
        where: {
          tabelaId: item.tabelaId,
          codigo: config.servicoLacreTerminalCodigo,
          deletedAt: null,
          ativo: true,
        },
      });
      if (!cobrado) {
        throw new BadRequestException(
          `Serviço de lacre da empresa (${config.servicoLacreTerminalCodigo}) não encontrado na tabela.`,
        );
      }
      const valor = Number(cobrado.valor);
      linhasExtras.push({
        unidadeProcessoId: processoId,
        cadastroServicoItemId: cobrado.id,
        codigo: cobrado.codigo,
        nome: cobrado.nome,
        quantidade: new Prisma.Decimal('1.00'),
        valorUnitario: new Prisma.Decimal(valor.toFixed(2)),
        valorTotal: new Prisma.Decimal(valor.toFixed(2)),
        payload: { efeito: 'NENHUM', vinculado: true, origemLacre: origem } as Prisma.InputJsonValue,
      });
    }

    return {
      payload: { efeito: 'SUBSTITUIR_LACRE_SAIDA' as const, lacre, origemLacre: origem, observacaoRic },
      linhasExtras,
    };
  }

  private async aplicarTransbordo(
    processoOrigemId: string,
    item: { nome: string },
    input: LancarServicoEfeitoInput,
  ) {
    const origem = await this.prisma.unidadeProcesso.findUnique({ where: { id: processoOrigemId } });
    if (!origem) throw new BadRequestException('ID de origem não encontrado.');

    const isoDestino = stripContainerIsoCanonical(input.isoDestino ?? '');
    if (!isoDestino || !isValidIso6346(isoDestino)) {
      throw new BadRequestException('Número ISO inválido (dígito verificador ISO 6346).');
    }
    if (isoDestino === origem.unidadeIso) {
      throw new BadRequestException('O container de destino (B) deve ser diferente da origem (A).');
    }

    const destino = await this.prisma.unidadeProcesso.findFirst({
      where: {
        tenantId: origem.tenantId,
        unidadeIso: isoDestino,
        status: StatusUnidadeProcesso.ABERTO,
        modalidade: 'PATIO',
      },
    });
    if (!destino) {
      throw new BadRequestException(`Unidade ${isoDestino} sem ID aberto. Abra o ID de B antes do transbordo.`);
    }
    if (destino.clienteId !== origem.clienteId) {
      throw new BadRequestException('Transbordo só é permitido entre unidades do mesmo cliente.');
    }

    await this.assertArmazenadaNoPatio(origem.unidadeIso, origem.id, origem.tenantId, 'A');
    await this.assertArmazenadaNoPatio(destino.unidadeIso, destino.id, destino.tenantId, 'B');

    const statusA = await this.lerStatusOperacional(origem.id, origem.unidadeIso);
    const statusB = await this.lerStatusOperacional(destino.id, destino.unidadeIso);
    if (statusA !== 'CHEIO') {
      throw new BadRequestException('A unidade de origem (A) precisa estar CHEIA para transbordo.');
    }
    if (statusB !== 'VAZIO') {
      throw new BadRequestException('A unidade de destino (B) precisa estar VAZIA para transbordo.');
    }

    await this.gravarStatusOperacional(origem.id, origem.unidadeIso, 'VAZIO');
    await this.gravarStatusOperacional(destino.id, destino.unidadeIso, 'CHEIO');

    const lacre = String(input.lacre ?? '').trim();
    const linhaOrigem = linhaObservacaoTransbordo({
      servico: item.nome,
      isoOrigem: origem.unidadeIso,
      isoDestino,
      papel: 'ORIGEM',
      statusAntes: 'CHEIO',
      statusDepois: 'VAZIO',
    });
    const linhaDestino = linhaObservacaoTransbordo({
      servico: item.nome,
      isoOrigem: origem.unidadeIso,
      isoDestino,
      papel: 'DESTINO',
      statusAntes: 'VAZIO',
      statusDepois: 'CHEIO',
      lacre,
    });
    await this.prisma.unidadeProcesso.update({
      where: { id: origem.id },
      data: { faturarHandlingComoCheio: true },
    });
    await this.prisma.unidadeProcesso.update({
      where: { id: destino.id },
      data: {
        faturarHandlingComoCheio: true,
        ...(lacre
          ? {
              lacreSaida: lacre,
              lacreSaidaObservacao: appendObservacao(destino.lacreSaidaObservacao, linhaDestino, 255),
            }
          : {}),
      },
    });
    await this.appendObservacaoSolicitacao(origem.entradaSolicitacaoId, linhaOrigem);
    await this.appendObservacaoSolicitacao(origem.saidaSolicitacaoId, linhaOrigem);
    await this.appendObservacaoSolicitacao(destino.entradaSolicitacaoId, linhaDestino);
    await this.appendObservacaoSolicitacao(destino.saidaSolicitacaoId, linhaDestino);

    await this.billing.persistHandlingCheio(origem.id);
    await this.billing.persistHandlingCheio(destino.id);

    return {
      payload: {
        efeito: 'TRANSBORDO_CARGA' as const,
        isoDestino,
        unidadeProcessoDestinoId: destino.id,
        ...(lacre ? { lacre } : {}),
      },
      linhasExtras: [],
    };
  }

  private async assertArmazenadaNoPatio(
    iso: string,
    unidadeProcessoId: string,
    tenantId: string,
    papel: 'A' | 'B',
  ) {
    const patio = await this.prisma.patioUnidade.findFirst({
      where: {
        unidadeIso: iso,
        status: { in: PATIO_STATUS_ARMAZENADA },
        OR: [{ unidadeProcessoId }, { solicitacao: { tenantId } }],
      },
      select: { id: true, status: true },
    });
    if (!patio) {
      throw new BadRequestException(
        `Unidade ${papel} (${iso}) não está armazenada no pátio. Transbordo só entre unidades já recebidas pela empresa — não é possível criar unidade do nada.`,
      );
    }
  }

  private async lerStatusOperacional(
    unidadeProcessoId: string,
    iso: string,
  ): Promise<'CHEIO' | 'VAZIO' | null> {
    const patio = await this.prisma.patioUnidade.findFirst({
      where: { unidadeProcessoId, unidadeIso: iso },
      select: { statusContainer: true, solicitacaoId: true },
    });
    if (patio?.statusContainer === StatusContainerTarifa.CHEIO) return 'CHEIO';
    if (patio?.statusContainer === StatusContainerTarifa.VAZIO) return 'VAZIO';

    const processo = await this.prisma.unidadeProcesso.findUnique({
      where: { id: unidadeProcessoId },
      select: { entradaSolicitacaoId: true },
    });
    const solicitacaoId = patio?.solicitacaoId ?? processo?.entradaSolicitacaoId;
    const form = solicitacaoId
      ? await this.prisma.containerSolicitacao.findFirst({
          where: { solicitacaoId, unidade: { equals: iso, mode: 'insensitive' } },
          select: { status: true },
        })
      : null;
    if (form?.status === StatusContainer.CHEIO) return 'CHEIO';
    if (form?.status === StatusContainer.VAZIO) return 'VAZIO';
    return null;
  }

  private async gravarStatusOperacional(
    unidadeProcessoId: string,
    iso: string,
    status: 'CHEIO' | 'VAZIO',
  ) {
    await this.prisma.patioUnidade.updateMany({
      where: { unidadeProcessoId, unidadeIso: iso },
      data: { statusContainer: status === 'CHEIO' ? StatusContainerTarifa.CHEIO : StatusContainerTarifa.VAZIO },
    });
    const patio = await this.prisma.patioUnidade.findFirst({
      where: { unidadeProcessoId, unidadeIso: iso },
      select: { solicitacaoId: true },
    });
    const processo = await this.prisma.unidadeProcesso.findUnique({
      where: { id: unidadeProcessoId },
      select: { entradaSolicitacaoId: true },
    });
    const solicitacaoId = patio?.solicitacaoId ?? processo?.entradaSolicitacaoId;
    if (!solicitacaoId) return;
    await this.prisma.containerSolicitacao.updateMany({
      where: { solicitacaoId, unidade: { equals: iso, mode: 'insensitive' } },
      data: { status: status === 'CHEIO' ? StatusContainer.CHEIO : StatusContainer.VAZIO },
    });
  }

  private async lacreAtualDoProcesso(processo: {
    unidadeIso?: string | null;
    lacreSaida?: string | null;
    entradaSolicitacaoId?: string | null;
  } | null): Promise<string | null> {
    if (!processo) return null;
    if (processo.lacreSaida?.trim()) return processo.lacreSaida.trim();
    if (!processo.entradaSolicitacaoId) return null;
    const iso = stripContainerIsoCanonical(processo.unidadeIso ?? '');
    const containers = await this.prisma.containerSolicitacao.findMany({
      where: { solicitacaoId: processo.entradaSolicitacaoId },
      select: { unidade: true, lacre: true },
    });
    const match = iso
      ? containers.find((c) => stripContainerIsoCanonical(c.unidade) === iso)
      : containers[0];
    return match?.lacre?.trim() || null;
  }

  private async appendObservacaoSolicitacao(solicitacaoId: string | null | undefined, linha: string) {
    const texto = linha.trim();
    if (!solicitacaoId || !texto) return;
    const s = await this.prisma.solicitacao.findUnique({
      where: { id: solicitacaoId },
      select: { operacaoFluxoJson: true },
    });
    if (!s) return;
    const json = this.fluxoComoRegistro(s.operacaoFluxoJson);
    const separado = separarObservacaoLivreEEfeitos(json.observacaoGate, json.observacoesEfeito);
    const efeitos = appendLinhaObservacaoEfeito(separado.efeitos, texto);
    const livreIgual = separado.livre === (typeof json.observacaoGate === 'string' ? json.observacaoGate.trim() : '');
    const efeitosIguais =
      efeitos.length === separado.efeitos.length && efeitos.every((x, i) => x === separado.efeitos[i]);
    if (livreIgual && efeitosIguais) return;
    json.observacaoGate = separado.livre;
    json.observacoesEfeito = efeitos;
    await this.prisma.solicitacao.update({
      where: { id: solicitacaoId },
      data: { operacaoFluxoJson: json as Prisma.InputJsonValue },
    });
  }

  private fluxoComoRegistro(raw: Prisma.JsonValue | null): Record<string, unknown> {
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return { ...(parsed as Record<string, unknown>) };
        }
      } catch {
        return {};
      }
      return {};
    }
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      return { ...(raw as Record<string, unknown>) };
    }
    return {};
  }
}
