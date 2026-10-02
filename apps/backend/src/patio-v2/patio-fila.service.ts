import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  MovTipo,
  PatioFilaStatus,
  PatioFilaTipo,
  PatioFilaUrgencia,
  PatioStatus,
} from '@prisma/client';
import { normalizeContainerIso } from '../common/utils/data-sanitize';
import { PrismaService } from '../prisma/prisma.service';
import { direcaoUnidade } from '../unidade-processo/unidade-direcao.util';
import { PatioV2Service } from './patio.service';
import {
  rotuloSugestaoPatio,
  sugerirZonaPatio,
  type PatioSugestao,
  type PatioSugestaoChaves,
  type PatioSugestaoVizinho,
} from './patio-fila-sugestao.util';
import {
  PATIO_POSICOES_POR_ZONA,
  PATIO_ZONAS,
  codigoPatioZonaPosicao,
  parsePatioZonaPosicao,
  sortPatioFila,
} from './patio-fila.util';
import { matchContainerSolicitacao } from './patio-saldo.util';

@Injectable()
export class PatioFilaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patio: PatioV2Service,
  ) {}

  async enfileirar(protocolo: string, urgencia: PatioFilaUrgencia) {
    const sol = await this.prisma.solicitacao.findFirst({
      where: { protocolo, deletedAt: null },
      include: {
        cliente: { select: { razaoSocial: true, nomeFantasia: true, tenantId: true } },
        containersSolicitacao: { orderBy: { ordem: 'asc' } },
      },
    });
    if (!sol) throw new NotFoundException('Operação não encontrada.');

    const direcao = direcaoUnidade(sol.tipoOperacao ?? '');
    const tipo = direcao === 'SAIDA' ? PatioFilaTipo.COLETA : PatioFilaTipo.BAIXA;
    const isos = sol.containersSolicitacao
      .map((c) => normalizeContainerIso(c.unidade).replace(/\s/g, '').toUpperCase())
      .filter(Boolean);
    if (!isos.length) throw new BadRequestException('A RIC não tem unidade para enviar ao pátio.');

    const criadas = [];
    for (const iso of isos) {
      const ja = await this.prisma.patioFilaTarefa.findFirst({
        where: { solicitacaoId: sol.id, unidadeIso: iso, status: PatioFilaStatus.PENDENTE },
      });
      if (ja) {
        const upd = await this.prisma.patioFilaTarefa.update({
          where: { id: ja.id },
          data: { urgencia },
        });
        criadas.push(this.toShape(upd));
        continue;
      }

      const patioUnidade = await this.prisma.patioUnidade.findFirst({
        where: { unidadeIso: iso },
        orderBy: { updatedAt: 'desc' },
        include: {
          posicaoAtual: { select: { codigoBaia: true } },
          movimentacoes: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { destino: { select: { codigoBaia: true } } },
          },
          unidadeProcesso: { select: { id: true, numero: true } },
        },
      });
      const cadastro = await this.prisma.cadastroPosicaoPatio.findFirst({
        where: { containerAtual: iso, deletedAt: null },
        select: { codigo: true },
      });
      const posicaoConhecida =
        patioUnidade?.posicaoAtual?.codigoBaia ??
        patioUnidade?.movimentacoes[0]?.destino?.codigoBaia ??
        cadastro?.codigo ??
        null;

      const row = await this.prisma.patioFilaTarefa.create({
        data: {
          urgencia,
          tipo,
          protocolo: sol.protocolo,
          solicitacaoId: sol.id,
          unidadeIso: iso,
          processoNumero: patioUnidade?.unidadeProcesso?.numero ?? null,
          clienteNome: sol.cliente.nomeFantasia || sol.cliente.razaoSocial,
          patioUnidadeId: patioUnidade?.id ?? null,
          unidadeProcessoId: patioUnidade?.unidadeProcesso?.id ?? null,
          posicaoConhecidaCodigo: posicaoConhecida,
        },
      });
      criadas.push(this.toShape(row));
    }

    return { items: criadas, total: criadas.length };
  }

  async listar() {
    const rows = await this.prisma.patioFilaTarefa.findMany({
      where: { status: PatioFilaStatus.PENDENTE },
      orderBy: { criadoEm: 'asc' },
    });
    const items = sortPatioFila(rows.map((r) => this.toShape(r)));
    const comSugestao = await this.anexarSugestoes(items);
    return { items: comSugestao, total: comSugestao.length };
  }

  async posicoes() {
    const ocupacao = await this.mapaOcupacao();
    const cadastradas = await this.prisma.posicaoPatioZona.findMany({
      where: { deletedAt: null, ativo: true },
      orderBy: { codigo: 'asc' },
      select: { codigo: true },
    });
    const zonas =
      cadastradas.length > 0 ? cadastradas.map((z) => z.codigo) : [...PATIO_ZONAS];
    const items = zonas.flatMap((zona) =>
      Array.from({ length: PATIO_POSICOES_POR_ZONA }, (_, i) => {
        const posicao = i + 1;
        const codigo = codigoPatioZonaPosicao(zona, posicao);
        const ocupadaPor = ocupacao.get(codigo) ?? null;
        return { codigo, zona, posicao, livre: !ocupadaPor, ocupadaPor };
      }),
    );
    return { origem: 'zona-posicao' as const, zonas, items };
  }

  async remocao(operadorId: string, origemRaw: string, destinoRaw: string) {
    const origem = parsePatioZonaPosicao(origemRaw);
    const destino = parsePatioZonaPosicao(destinoRaw);
    if (!origem || !destino) {
      throw new BadRequestException('Informe a posição de origem e a de destino.');
    }
    const origemCodigo = codigoPatioZonaPosicao(origem.zona, origem.posicao);
    const destinoCodigo = codigoPatioZonaPosicao(destino.zona, destino.posicao);
    if (origemCodigo === destinoCodigo) {
      throw new BadRequestException('Escolha um espaço livre diferente.');
    }

    const ocupacao = await this.mapaOcupacao();
    const iso = ocupacao.get(origemCodigo);
    if (!iso) throw new BadRequestException('Essa posição não está ocupada.');
    if (ocupacao.get(destinoCodigo)) {
      throw new BadRequestException('O destino precisa estar livre.');
    }

    const patioUnidade = await this.prisma.patioUnidade.findFirst({
      where: { unidadeIso: iso },
      orderBy: { updatedAt: 'desc' },
    });
    if (patioUnidade) {
      await this.ensureBaia(destinoCodigo);
      await this.patio.movimentar(operadorId, {
        unidadeId: patioUnidade.id,
        codigoBaiaOrigem: origemCodigo,
        codigoBaiaDestino: destinoCodigo,
        tipo: MovTipo.REPOSICIONAMENTO,
        observacao: 'Remoção',
      });
    }

    await this.liberarCadastro(origemCodigo);
    await this.ocuparCadastro(destinoCodigo, iso);
    await this.prisma.patioFilaTarefa.updateMany({
      where: {
        unidadeIso: iso,
        status: PatioFilaStatus.CONCLUIDA,
        tipo: PatioFilaTipo.BAIXA,
        posicaoConfirmadaCodigo: origemCodigo,
      },
      data: { posicaoConfirmadaCodigo: destinoCodigo },
    });

    return { origem: origemCodigo, destino: destinoCodigo, unidadeIso: iso };
  }

  async confirmar(id: string, operadorId: string, posicaoCodigoRaw?: string) {
    const tarefa = await this.prisma.patioFilaTarefa.findFirst({
      where: { id, status: PatioFilaStatus.PENDENTE },
    });
    if (!tarefa) throw new NotFoundException('Tarefa de pátio não encontrada.');

    const informado = posicaoCodigoRaw?.trim()
      ? parsePatioZonaPosicao(posicaoCodigoRaw)
      : null;
    const posicaoCodigo = informado
      ? codigoPatioZonaPosicao(informado.zona, informado.posicao)
      : null;

    const patioUnidade = await this.resolverPatioUnidade(tarefa);
    if (posicaoCodigo && patioUnidade && tarefa.tipo === PatioFilaTipo.BAIXA) {
      await this.ensureBaia(posicaoCodigo);
      await this.patio.posicionar(operadorId, {
        unidadeId: patioUnidade.id,
        codigoBaia: posicaoCodigo,
        tipo: 'LIFT_ON',
        observacao: `Fila ${tarefa.urgencia}`,
      });
    } else if (tarefa.tipo === PatioFilaTipo.COLETA && patioUnidade) {
      await this.prisma.patioUnidade.update({
        where: { id: patioUnidade.id },
        data: { posicaoAtualId: null, status: PatioStatus.AGUARDANDO_GATE_OUT },
      });
    }

    if (posicaoCodigo) {
      await this.sincronizarCadastro(posicaoCodigo, tarefa);
    }

    const done = await this.prisma.patioFilaTarefa.update({
      where: { id: tarefa.id },
      data: {
        status: PatioFilaStatus.CONCLUIDA,
        posicaoConfirmadaCodigo: posicaoCodigo,
        concluidoEm: new Date(),
        operadorId,
      },
    });
    return this.toShape(done);
  }

  private async mapaOcupacao(): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const isoNaGrade = new Set<string>();
    const unidades = await this.prisma.patioUnidade.findMany({
      where: { posicaoAtualId: { not: null } },
      select: { unidadeIso: true, posicaoAtual: { select: { codigoBaia: true } } },
    });
    for (const u of unidades) {
      const parsed = parsePatioZonaPosicao(u.posicaoAtual?.codigoBaia);
      if (!parsed) continue;
      map.set(codigoPatioZonaPosicao(parsed.zona, parsed.posicao), u.unidadeIso);
      isoNaGrade.add(u.unidadeIso);
    }
    const cadastros = await this.prisma.cadastroPosicaoPatio.findMany({
      where: { deletedAt: null, containerAtual: { not: null } },
      select: { codigo: true, containerAtual: true },
    });
    for (const c of cadastros) {
      if (!c.containerAtual || isoNaGrade.has(c.containerAtual)) continue;
      const parsed = parsePatioZonaPosicao(c.codigo);
      if (!parsed) continue;
      const codigo = codigoPatioZonaPosicao(parsed.zona, parsed.posicao);
      if (map.has(codigo)) continue;
      map.set(codigo, c.containerAtual);
      isoNaGrade.add(c.containerAtual);
    }
    const tarefas = await this.prisma.patioFilaTarefa.findMany({
      where: { status: PatioFilaStatus.CONCLUIDA, posicaoConfirmadaCodigo: { not: null } },
      orderBy: { concluidoEm: 'asc' },
      select: { tipo: true, unidadeIso: true, posicaoConfirmadaCodigo: true },
    });
    for (const t of tarefas) {
      if (isoNaGrade.has(t.unidadeIso)) continue;
      const parsed = parsePatioZonaPosicao(t.posicaoConfirmadaCodigo);
      if (!parsed) continue;
      const codigo = codigoPatioZonaPosicao(parsed.zona, parsed.posicao);
      if (t.tipo === PatioFilaTipo.BAIXA) map.set(codigo, t.unidadeIso);
      else map.delete(codigo);
    }
    return map;
  }

  private async resolverPatioUnidade(tarefa: { patioUnidadeId: string | null; unidadeIso: string }) {
    if (tarefa.patioUnidadeId) {
      const byId = await this.prisma.patioUnidade.findUnique({ where: { id: tarefa.patioUnidadeId } });
      if (byId) return byId;
    }
    return this.prisma.patioUnidade.findFirst({
      where: { unidadeIso: tarefa.unidadeIso },
      orderBy: { updatedAt: 'desc' },
    });
  }

  private async ensureBaia(codigo: string) {
    const codigoBaia = codigo.trim().toUpperCase();
    const existing = await this.prisma.patioPosicao.findUnique({ where: { codigoBaia } });
    if (existing) return existing;
    return this.prisma.patioPosicao.create({
      data: { codigoBaia, comprimento: 1, largura: 1, capacidade: 1 },
    });
  }

  private async ocuparCadastro(codigo: string, unidadeIso: string) {
    const pos = await this.prisma.cadastroPosicaoPatio.findFirst({
      where: { codigo, deletedAt: null },
    });
    if (!pos) return;
    await this.prisma.cadastroPosicaoPatio.update({
      where: { id: pos.id },
      data: { status: 'OCUPADO', containerAtual: unidadeIso },
    });
    await this.prisma.cadastroPosicaoPatio.updateMany({
      where: { containerAtual: unidadeIso, deletedAt: null, NOT: { id: pos.id } },
      data: { status: 'LIVRE', containerAtual: null },
    });
  }

  private async liberarCadastro(codigo: string) {
    await this.prisma.cadastroPosicaoPatio.updateMany({
      where: { codigo, deletedAt: null },
      data: { status: 'LIVRE', containerAtual: null },
    });
  }

  private async sincronizarCadastro(
    codigo: string,
    tarefa: { tipo: PatioFilaTipo; unidadeIso: string },
  ) {
    const pos = await this.prisma.cadastroPosicaoPatio.findFirst({
      where: { codigo, deletedAt: null },
    });
    if (!pos) return;
    if (tarefa.tipo === PatioFilaTipo.BAIXA) {
      await this.prisma.cadastroPosicaoPatio.update({
        where: { id: pos.id },
        data: { status: 'OCUPADO', containerAtual: tarefa.unidadeIso },
      });
      return;
    }
    await this.prisma.cadastroPosicaoPatio.update({
      where: { id: pos.id },
      data: { status: 'LIVRE', containerAtual: null },
    });
    await this.prisma.cadastroPosicaoPatio.updateMany({
      where: { containerAtual: tarefa.unidadeIso, deletedAt: null, NOT: { id: pos.id } },
      data: { status: 'LIVRE', containerAtual: null },
    });
  }

  private toShape(row: {
    id: string;
    urgencia: PatioFilaUrgencia;
    tipo: PatioFilaTipo;
    status: PatioFilaStatus;
    protocolo: string;
    solicitacaoId: string;
    unidadeIso: string;
    processoNumero: number | null;
    clienteNome: string | null;
    posicaoConhecidaCodigo: string | null;
    posicaoConfirmadaCodigo: string | null;
    criadoEm: Date;
    concluidoEm: Date | null;
  }) {
    const conhecida = parsePatioZonaPosicao(row.posicaoConhecidaCodigo);
    const confirmada = parsePatioZonaPosicao(row.posicaoConfirmadaCodigo);
    return {
      id: row.id,
      urgencia: row.urgencia,
      tipo: row.tipo,
      status: row.status,
      protocolo: row.protocolo,
      solicitacaoId: row.solicitacaoId,
      unidadeIso: row.unidadeIso,
      processoNumero: row.processoNumero,
      processoLabel: row.processoNumero != null ? `ID ${row.processoNumero}` : null,
      clienteNome: row.clienteNome,
      posicaoConhecidaCodigo: row.posicaoConhecidaCodigo,
      posicaoConfirmadaCodigo: row.posicaoConfirmadaCodigo,
      zonaConhecida: conhecida?.zona ?? null,
      posicaoConhecida: conhecida?.posicao ?? null,
      zonaConfirmada: confirmada?.zona ?? null,
      posicaoConfirmada: confirmada?.posicao ?? null,
      sugestaoZona: null as string | null,
      sugestaoMotivo: null as PatioSugestao['motivo'] | null,
      sugestaoLabel: 'Sem Sugestão',
      criadoEm: row.criadoEm.toISOString(),
      concluidoEm: row.concluidoEm?.toISOString() ?? null,
    };
  }

  private async anexarSugestoes<
    T extends {
      solicitacaoId: string;
      unidadeIso: string;
      tipo: PatioFilaTipo;
      processoNumero: number | null;
    },
  >(items: T[]) {
    if (!items.length) return items;
    const [ocupacao, vizinhos, sols] = await Promise.all([
      this.mapaOcupacao(),
      this.vizinhosSugestao(),
      this.prisma.solicitacao.findMany({
        where: { id: { in: [...new Set(items.map((i) => i.solicitacaoId))] } },
        select: {
          id: true,
          clienteId: true,
          containersSolicitacao: {
            select: { unidade: true, booking: true, navio: true, processo: true },
          },
        },
      }),
    ]);
    const livres = await this.livresPorZona(ocupacao);
    const solPorId = new Map(sols.map((s) => [s.id, s]));

    return items.map((item) => {
      const sol = solPorId.get(item.solicitacaoId);
      const c = sol
        ? matchContainerSolicitacao(item.unidadeIso, sol.containersSolicitacao)
        : null;
      const chaves: PatioSugestaoChaves = {
        clienteId: sol?.clienteId ?? null,
        navio: c?.navio ?? null,
        booking: c?.booking ?? null,
        processo: c?.processo ?? null,
        processoNumero: item.processoNumero,
      };
      const sugestao = sugerirZonaPatio(chaves, vizinhos, livres, item.unidadeIso);
      return {
        ...item,
        sugestaoZona: sugestao?.zona ?? null,
        sugestaoMotivo: sugestao?.motivo ?? null,
        sugestaoLabel: rotuloSugestaoPatio(sugestao),
      };
    });
  }

  private async vizinhosSugestao(): Promise<PatioSugestaoVizinho[]> {
    const unidades = await this.prisma.patioUnidade.findMany({
      where: { posicaoAtualId: { not: null } },
      select: {
        unidadeIso: true,
        posicaoAtual: { select: { codigoBaia: true } },
        unidadeProcesso: { select: { numero: true } },
        solicitacao: {
          select: {
            clienteId: true,
            containersSolicitacao: {
              select: { unidade: true, booking: true, navio: true, processo: true },
            },
          },
        },
      },
    });
    const out: PatioSugestaoVizinho[] = [];
    for (const u of unidades) {
      const parsed = parsePatioZonaPosicao(u.posicaoAtual?.codigoBaia);
      if (!parsed) continue;
      const c = matchContainerSolicitacao(u.unidadeIso, u.solicitacao.containersSolicitacao);
      out.push({
        zona: parsed.zona,
        unidadeIso: u.unidadeIso,
        clienteId: u.solicitacao.clienteId,
        navio: c?.navio ?? null,
        booking: c?.booking ?? null,
        processo: c?.processo ?? null,
        processoNumero: u.unidadeProcesso?.numero ?? null,
      });
    }
    return out;
  }

  private async livresPorZona(ocupacao: Map<string, string>): Promise<Map<string, number>> {
    const cadastradas = await this.prisma.posicaoPatioZona.findMany({
      where: { deletedAt: null, ativo: true },
      orderBy: { codigo: 'asc' },
      select: { codigo: true },
    });
    const zonas = cadastradas.length > 0 ? cadastradas.map((z) => z.codigo) : [...PATIO_ZONAS];
    const livres = new Map<string, number>();
    for (const zona of zonas) {
      let n = 0;
      for (let i = 1; i <= PATIO_POSICOES_POR_ZONA; i++) {
        if (!ocupacao.get(codigoPatioZonaPosicao(zona, i))) n++;
      }
      livres.set(zona, n);
    }
    return livres;
  }
}
