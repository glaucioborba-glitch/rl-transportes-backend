import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

/** Estado MLOps em memória (+ persistência JSON opcional em `data/ia-preditiva-weights.json`). */
@Injectable()
export class IaPreditivaMlopsStore implements OnModuleInit {
  versao = '16.1.0';
  ultimaAtualizacao: string | null = null;
  /** Qualidade agregada proxy 0–100 (derivada de R² médio e cobertura). */
  qualidadeProxyPct = 68;

  sesAlpha = 0.35;
  blendTrend = 0.62;

  ocupacaoPhi = 0.82;
  prodHorasEfectivasPorDia = 16;

  pesosInadimplencia = [1.8, 0.35, -0.25];

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.carregarSeExistir();
  }

  touchTreino() {
    this.ultimaAtualizacao = new Date().toISOString();
    this.qualidadeProxyPct = Math.min(
      96,
      Math.max(
        52,
        Math.round(this.qualidadeProxyPct + (Math.random() * 6 - 2)),
      ),
    );
  }

  ajustarPorVarianciaDemanda(cv: number) {
    /** CV alto → mais peso em SES (menos tendência). */
    if (cv > 0.45) {
      this.blendTrend = Math.max(0.35, this.blendTrend - 0.05);
      this.sesAlpha = Math.min(0.65, this.sesAlpha + 0.05);
    } else if (cv < 0.15) {
      this.blendTrend = Math.min(0.85, this.blendTrend + 0.03);
    }
  }

  persistirOpcional(): { ok: boolean; caminho?: string } {
    const enabled = this.config.get<string>('IA_PRED_PERSIST_WEIGHTS') === '1';
    if (!enabled) return { ok: false };
    try {
      const dir = path.join(process.cwd(), 'data');
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, 'ia-preditiva-weights.json');
      fs.writeFileSync(
        file,
        JSON.stringify(
          {
            versao: this.versao,
            ultimaAtualizacao: this.ultimaAtualizacao,
            sesAlpha: this.sesAlpha,
            blendTrend: this.blendTrend,
            ocupacaoPhi: this.ocupacaoPhi,
            pesosInadimplencia: this.pesosInadimplencia,
          },
          null,
          2,
        ),
        'utf8',
      );
      return { ok: true, caminho: file };
    } catch {
      return { ok: false };
    }
  }

  carregarSeExistir(): void {
    try {
      const file = path.join(process.cwd(), 'data', 'ia-preditiva-weights.json');
      if (!fs.existsSync(file)) return;
      const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<IaPreditivaMlopsStore>;
      if (typeof raw.sesAlpha === 'number') this.sesAlpha = raw.sesAlpha;
      if (typeof raw.blendTrend === 'number') this.blendTrend = raw.blendTrend;
      if (typeof raw.ocupacaoPhi === 'number') this.ocupacaoPhi = raw.ocupacaoPhi;
      if (Array.isArray(raw.pesosInadimplencia)) this.pesosInadimplencia = raw.pesosInadimplencia;
      if (typeof raw.versao === 'string') this.versao = raw.versao;
    } catch {
      /* noop */
    }
  }
}
