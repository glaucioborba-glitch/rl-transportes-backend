import { BadRequestException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { construirStarSchema } from '../datahub-star.builder';
import type { RawExtractBundle } from '../datahub-extract.types';
import type { DwBuildResult } from '../datahub-star.builder';
import { DatahubDwStore } from '../datahub-dw.store';
import { DatahubEtlStore } from '../datahub-etl.store';

@Injectable()
export class DatahubEtlService {
  private ultimoExtract: RawExtractBundle | null = null;
  private ultimoBuild: DwBuildResult | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly dw: DatahubDwStore,
    private readonly etl: DatahubEtlStore,
  ) {}

  async extrair() {
    const inicio = Date.now();
    const started = new Date(inicio).toISOString();
    try {
      const bundle = await this.coletarRaw();
      this.ultimoExtract = bundle;
      const linhas =
        bundle.clientes.length +
        bundle.solicitacoes.length +
        bundle.faturamentos.length +
        bundle.boletos.length +
        bundle.nfs.length;
      const exec = this.etl.registrar({
        fase: 'extrair',
        status: 'SUCESSO',
        iniciadoEm: started,
        finalizadoEm: new Date().toISOString(),
        duracaoMs: Date.now() - inicio,
        linhasEntrada: linhas,
        linhasSaida: linhas,
      });
      return {
        mensagem: 'Extração read-only concluída (staging em memória).',
        execucao: exec,
        resumo: {
          clientes: bundle.clientes.length,
          solicitacoes: bundle.solicitacoes.length,
          faturamentos: bundle.faturamentos.length,
          boletos: bundle.boletos.length,
          nfs: bundle.nfs.length,
          usuariosInternos: bundle.usuariosInternos.length,
          auditoriaLinhas: bundle.auditoriaLinhas,
        },
      };
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      this.etl.registrar({
        fase: 'extrair',
        status: 'FALHA',
        iniciadoEm: started,
        finalizadoEm: new Date().toISOString(),
        duracaoMs: Date.now() - inicio,
        mensagem: err,
      });
      throw e;
    }
  }

  transformar() {
    const inicio = Date.now();
    const started = new Date(inicio).toISOString();
    if (!this.ultimoExtract) {
      throw new BadRequestException('Execute POST /datahub/etl/extrair antes do transformar.');
    }
    try {
      const built = construirStarSchema(this.ultimoExtract);
      this.ultimoBuild = built;
      const exec = this.etl.registrar({
        fase: 'transformar',
        status: 'SUCESSO',
        iniciadoEm: started,
        finalizadoEm: new Date().toISOString(),
        duracaoMs: Date.now() - inicio,
        linhasEntrada: built.linhasTotal,
        linhasSaida: built.linhasTotal,
      });
      return {
        mensagem: 'Modelagem Kimball simulada aplicada sobre o último extract.',
        execucao: exec,
        linhasGeradas: built.linhasTotal,
      };
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      this.etl.registrar({
        fase: 'transformar',
        status: 'FALHA',
        iniciadoEm: started,
        finalizadoEm: new Date().toISOString(),
        duracaoMs: Date.now() - inicio,
        mensagem: err,
      });
      throw e;
    }
  }

  carregar() {
    const inicio = Date.now();
    const started = new Date(inicio).toISOString();
    if (!this.ultimoBuild) {
      throw new BadRequestException('Execute transformar antes do carregar.');
    }
    try {
      this.dw.substituir(this.ultimoBuild.fatos, this.ultimoBuild.dimensoes);
      const exec = this.etl.registrar({
        fase: 'carregar',
        status: 'SUCESSO',
        iniciadoEm: started,
        finalizadoEm: new Date().toISOString(),
        duracaoMs: Date.now() - inicio,
        linhasEntrada: this.ultimoBuild.linhasTotal,
        linhasSaida: this.ultimoBuild.linhasTotal,
      });
      return {
        mensagem: 'DW em memória atualizado.',
        execucao: exec,
        linhas: this.ultimoBuild.linhasTotal,
      };
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      this.etl.registrar({
        fase: 'carregar',
        status: 'FALHA',
        iniciadoEm: started,
        finalizadoEm: new Date().toISOString(),
        duracaoMs: Date.now() - inicio,
        mensagem: err,
      });
      throw e;
    }
  }

  private async coletarRaw(): Promise<RawExtractBundle> {
    const t0 = Date.now();
    const [
      clientes,
      solicitacoes,
      faturamentos,
      boletos,
      nfs,
      usuariosInternos,
      auditoriaLinhas,
    ] = await Promise.all([
      this.prisma.cliente.findMany({
        where: { deletedAt: null },
        take: 6000,
        select: { id: true, nome: true, tipo: true },
      }),
      this.prisma.solicitacao.findMany({
        where: { deletedAt: null },
        take: 10000,
        include: {
          portaria: true,
          gate: true,
          patio: true,
          saida: true,
          unidades: true,
        },
      }),
      this.prisma.faturamento.findMany({
        take: 8000,
        select: {
          id: true,
          clienteId: true,
          periodo: true,
          valorTotal: true,
          createdAt: true,
          itens: { select: { id: true } },
        },
      }),
      this.prisma.boleto.findMany({
        take: 12000,
        select: {
          id: true,
          valorBoleto: true,
          dataVencimento: true,
          statusPagamento: true,
          faturamento: { select: { clienteId: true } },
        },
      }),
      this.prisma.nfsEmitida.findMany({
        take: 8000,
        select: {
          id: true,
          faturamentoId: true,
          statusIpm: true,
          createdAt: true,
          faturamento: { select: { clienteId: true } },
        },
      }),
      this.prisma.user.findMany({
        where: { role: { not: Role.CLIENTE } },
        take: 3000,
        select: { id: true, role: true },
      }),
      this.prisma.auditoria.count(),
    ]);

    const bundle: RawExtractBundle = {
      extraidoEm: new Date().toISOString(),
      duracaoMs: Date.now() - t0,
      clientes: clientes.map((c) => ({
        id: c.id,
        nome: c.nome,
        tipo: String(c.tipo),
      })),
      solicitacoes: solicitacoes.map((s) => ({
        id: s.id,
        clienteId: s.clienteId,
        protocolo: s.protocolo,
        status: String(s.status),
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        qtUnidades: s.unidades?.length ?? 0,
        hasPortaria: !!s.portaria,
        hasGate: !!s.gate,
        hasPatio: !!s.patio,
        hasSaida: !!s.saida,
        gateRicAssinado: s.gate?.ricAssinado ?? false,
        saidaEm: s.saida?.dataHoraSaida ?? null,
      })),
      faturamentos: faturamentos.map((f) => ({
        id: f.id,
        clienteId: f.clienteId,
        periodo: f.periodo,
        valorTotal: Number(f.valorTotal),
        createdAt: f.createdAt,
        qtItens: f.itens?.length ?? 0,
      })),
      boletos: boletos.map((b) => ({
        id: b.id,
        clienteId: b.faturamento.clienteId,
        valor: Number(b.valorBoleto),
        vencimento: b.dataVencimento,
        statusPagamento: String(b.statusPagamento),
      })),
      nfs: nfs.map((n) => ({
        id: n.id,
        faturamentoId: n.faturamentoId,
        clienteId: n.faturamento.clienteId,
        statusIpm: n.statusIpm,
        createdAt: n.createdAt,
      })),
      usuariosInternos: usuariosInternos.map((u) => ({
        id: u.id,
        role: String(u.role),
      })),
      auditoriaLinhas,
    };

    return bundle;
  }
}
