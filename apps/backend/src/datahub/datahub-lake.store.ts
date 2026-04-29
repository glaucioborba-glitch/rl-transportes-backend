import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import type { LakeFileRecord, LakeOrigem } from './datahub.types';

const GZIP_SIM_RATIO = 0.35;

@Injectable()
export class DatahubLakeStore {
  readonly arquivos: LakeFileRecord[] = [];

  /** Snapshot JSON bruto com versionamento virtual YYYY/MM/DD/HH/mm (compressão gzip apenas simulada). */
  ingestir(origem: LakeOrigem, payload: Record<string, unknown>): LakeFileRecord {
    const now = new Date();
    const y = now.getUTCFullYear();
    const mo = String(now.getUTCMonth() + 1).padStart(2, '0');
    const d = String(now.getUTCDate()).padStart(2, '0');
    const h = String(now.getUTCHours()).padStart(2, '0');
    const mi = String(now.getUTCMinutes()).padStart(2, '0');
    const id = randomUUID();
    const pathVirtual = `raw/${origem}/${y}/${mo}/${d}/${h}/${mi}/${id}.json`;
    const raw = Buffer.from(JSON.stringify(payload), 'utf8');
    const tamanhoBrutoBytes = raw.length;
    const rec: LakeFileRecord = {
      id,
      pathVirtual,
      origem,
      criadoEm: now.toISOString(),
      tamanhoBrutoBytes,
      gzipSimuladoRatio: GZIP_SIM_RATIO,
      bytesCompactadosAprox: Math.max(1, Math.round(tamanhoBrutoBytes * GZIP_SIM_RATIO)),
    };
    this.arquivos.push(rec);
    return rec;
  }

  listar(): LakeFileRecord[] {
    return [...this.arquivos].reverse();
  }
}
