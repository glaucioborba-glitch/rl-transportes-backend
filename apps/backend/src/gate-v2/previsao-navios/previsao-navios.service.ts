import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  parseZp21MovimentacaoHtml,
  type Zp21MovimentacaoSnapshot,
} from './zp21-movimentacao.parser';

export const ZP21_MOVIMENTACAO_URL =
  'https://praticoszp21.com.br/movimentacao-de-navios/';

export type PrevisaoNaviosResponse = Zp21MovimentacaoSnapshot & {
  fonte: string;
  fonteUrl: string;
  atualizadoEm: string;
  stale: boolean;
};

@Injectable()
export class PrevisaoNaviosService implements OnModuleInit {
  private readonly logger = new Logger(PrevisaoNaviosService.name);
  private cache: Zp21MovimentacaoSnapshot | null = null;
  private atualizadoEm: Date | null = null;
  private syncing = false;
  private lastError: string | null = null;

  /** Considera stale após 20 min sem sync bem-sucedido. */
  private readonly staleAfterMs = 20 * 60 * 1000;

  async onModuleInit() {
    void this.syncFromFonte().catch((err) => {
      this.logger.warn(
        `Sync inicial ZP21 falhou (página usará retry sob demanda): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    });
  }

  @Cron(CronExpression.EVERY_10_MINUTES, { timeZone: 'America/Sao_Paulo' })
  async handleCron() {
    try {
      await this.syncFromFonte();
    } catch (err) {
      this.logger.error(
        'CRON previsão navios (ZP21) falhou',
        err instanceof Error ? err.stack : err,
      );
    }
  }

  async getSnapshot(forceRefresh = false): Promise<PrevisaoNaviosResponse> {
    if (forceRefresh || !this.cache || this.isStale()) {
      try {
        await this.syncFromFonte();
      } catch (err) {
        if (!this.cache) {
          throw new ServiceUnavailableException(
            `Não foi possível obter a movimentação de navios da ZP21: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
        this.logger.warn(
          `Usando cache stale após falha no refresh: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    if (!this.cache || !this.atualizadoEm) {
      throw new ServiceUnavailableException(
        this.lastError ?? 'Previsão de navios ainda não disponível.',
      );
    }

    return {
      fonte: 'ZP21 Práticos — Itajaí / Navegantes',
      fonteUrl: ZP21_MOVIMENTACAO_URL,
      atualizadoEm: this.atualizadoEm.toISOString(),
      stale: this.isStale(),
      ...this.cache,
    };
  }

  async syncFromFonte(): Promise<void> {
    if (this.syncing) return;
    this.syncing = true;
    try {
      const html = await this.fetchHtml(ZP21_MOVIMENTACAO_URL);
      const snap = parseZp21MovimentacaoHtml(html);
      if (
        snap.previstos.length === 0 &&
        snap.atracados.length === 0 &&
        snap.fundeados.length === 0 &&
        snap.manobrasPrevistas.length === 0
      ) {
        throw new Error('Parser ZP21 retornou tabelas vazias — layout pode ter mudado.');
      }
      this.cache = snap;
      this.atualizadoEm = new Date();
      this.lastError = null;
      this.logger.log(
        `ZP21 sync OK: ${snap.previstos.length} previstos, ${snap.atracados.length} atracados, ${snap.fundeados.length} fundeados, ${snap.manobrasPrevistas.length} manobras`,
      );
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      this.syncing = false;
    }
  }

  private isStale(): boolean {
    if (!this.atualizadoEm) return true;
    return Date.now() - this.atualizadoEm.getTime() > this.staleAfterMs;
  }

  private async fetchHtml(url: string): Promise<string> {
    const res = await fetch(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'RL-Transportes-Gate/1.0 (+previsao-navios)',
      },
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ao buscar ${url}`);
    }
    return res.text();
  }
}
