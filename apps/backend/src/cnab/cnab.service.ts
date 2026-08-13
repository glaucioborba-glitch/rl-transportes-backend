import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { StatusArquivoBancario, TipoArquivoBancario } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CnabParserService } from './cnab-parser.service';
import { ConciliacaoService } from './conciliacao.service';
import type { LogProcessamentoCnab } from './types/cnab.types';

@Injectable()
export class CnabService {
  private readonly logger = new Logger(CnabService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: CnabParserService,
    private readonly conciliacao: ConciliacaoService,
  ) {}

  async uploadRetorno(tenantId: string, file: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Arquivo obrigatório');
    }

    const nome = (file.originalname ?? 'retorno.txt').trim();
    const ext = nome.split('.').pop()?.toLowerCase() ?? '';
    if (!['txt', 'ret'].includes(ext)) {
      throw new BadRequestException('Somente arquivos .txt ou .RET são aceitos');
    }

    const conteudo = file.buffer.toString('latin1');
    const linhasArquivo = conteudo.split(/\r?\n/).filter((l) => l.trim()).length;

    const arquivo = await this.prisma.arquivoBancario.create({
      data: {
        tenantId,
        nomeArquivo: nome,
        tipo: TipoArquivoBancario.RETORNO,
        status: StatusArquivoBancario.PROCESSANDO,
      },
    });

    try {
      const { formato, linhas } = this.parser.parseRetorno(conteudo);
      const conciliacao = await this.conciliacao.processarRetorno(arquivo.id, tenantId, {
        nomeArquivo: nome,
        linhas,
      });

      const log: LogProcessamentoCnab = {
        formatoDetectado: formato,
        linhasArquivo,
        linhasParseadas: linhas.length,
        faturasBaixadas: conciliacao.faturasBaixadas,
        faturasNaoEncontradas: conciliacao.faturasNaoEncontradas,
        faturasValorDivergente: conciliacao.faturasValorDivergente,
        clientesDesbloqueados: conciliacao.clientesDesbloqueados,
        erros: conciliacao.erros.slice(0, 100),
        resumo: conciliacao.resumo,
      };

      const updated = await this.prisma.arquivoBancario.update({
        where: { id: arquivo.id },
        data: {
          status: StatusArquivoBancario.CONCLUIDO,
          processadoEm: new Date(),
          logProcessamento: log as object,
        },
      });

      this.logger.log(`CNAB retorno processado id=${arquivo.id} — ${log.resumo}`);
      return this.toDto(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      await this.prisma.arquivoBancario.update({
        where: { id: arquivo.id },
        data: {
          status: StatusArquivoBancario.ERRO,
          processadoEm: new Date(),
          logProcessamento: {
            resumo: `Falha no processamento: ${message}`,
            faturasBaixadas: 0,
            faturasNaoEncontradas: 0,
            faturasValorDivergente: 0,
            clientesDesbloqueados: 0,
            erros: [{ nossoNumero: '—', motivo: message }],
          } satisfies LogProcessamentoCnab,
        },
      });
      throw err;
    }
  }

  async listarHistorico(tenantId: string, limit = 50) {
    const rows = await this.prisma.arquivoBancario.findMany({
      where: { tenantId },
      orderBy: { dataUpload: 'desc' },
      take: Math.min(limit, 100),
    });
    return rows.map((r) => this.toDto(r));
  }

  private toDto(row: {
    id: string;
    tenantId: string;
    nomeArquivo: string;
    tipo: TipoArquivoBancario;
    status: StatusArquivoBancario;
    dataUpload: Date;
    processadoEm: Date | null;
    logProcessamento: unknown;
  }) {
    const log = (row.logProcessamento ?? null) as LogProcessamentoCnab | null;
    return {
      id: row.id,
      tenantId: row.tenantId,
      nomeArquivo: row.nomeArquivo,
      tipo: row.tipo,
      status: row.status,
      dataUpload: row.dataUpload.toISOString(),
      processadoEm: row.processadoEm?.toISOString() ?? null,
      resumo: log?.resumo ?? null,
      logProcessamento: log,
    };
  }
}
