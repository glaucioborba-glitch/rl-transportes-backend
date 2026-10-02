import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { foldComparable } from './address-normalizer';
import type { IbgeMunicipioRecord } from './types/ibge-municipio.types';

const REDIS_KEY = 'IBGE_MUNICIPIOS';
const CACHE_TTL_SEC = 24 * 60 * 60;
const IBGE_URL = 'https://servicodados.ibge.gov.br/api/v1/localidades/municipios';
const FETCH_TIMEOUT_MS = 60_000;

/** Resposta bruta do IBGE (subset). */
type IbgeApiMunicipio = {
  id: number;
  nome: string;
  microrregiao?: {
    mesorregiao?: {
      UF?: { sigla?: string };
    };
  };
};

@Injectable()
export class IbgeService {
  private readonly logger = new Logger(IbgeService.name);

  constructor(private readonly redis: RedisService) {}

  async getMunicipios(): Promise<IbgeMunicipioRecord[]> {
    const cached = await this.redis.get(REDIS_KEY);
    if (cached) {
      try {
        return JSON.parse(cached) as IbgeMunicipioRecord[];
      } catch {
        await this.redis.del(REDIS_KEY);
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let rows: IbgeApiMunicipio[];
    try {
      const res = await fetch(IBGE_URL, { signal: controller.signal });
      if (!res.ok) {
        throw new Error(`IBGE HTTP ${res.status}`);
      }
      rows = (await res.json()) as IbgeApiMunicipio[];
    } catch (e) {
      this.logger.warn(`Falha ao carregar municípios IBGE: ${(e as Error).message}`);
      return [];
    } finally {
      clearTimeout(timer);
    }

    const list: IbgeMunicipioRecord[] = rows.map((m) => ({
      codigoIbge: String(m.id),
      nome: m.nome,
      uf: m.microrregiao?.mesorregiao?.UF?.sigla ?? '',
    })).filter((m) => m.codigoIbge.length === 7 && m.uf.length === 2);

    await this.redis.setex(REDIS_KEY, CACHE_TTL_SEC, JSON.stringify(list));
    return list;
  }

  /** Confirma que o código existe e opcionalmente bate com UF/nome (nome fold). */
  async assertIbgeValid(codigoIbge: string, uf?: string, nomeFold?: string): Promise<IbgeMunicipioRecord | null> {
    const list = await this.getMunicipios();
    const row = list.find((m) => m.codigoIbge === codigoIbge);
    if (!row) return null;
    if (uf && row.uf !== uf.toUpperCase()) return null;
    if (nomeFold && foldComparable(row.nome) !== nomeFold) return null;
    return row;
  }
}
