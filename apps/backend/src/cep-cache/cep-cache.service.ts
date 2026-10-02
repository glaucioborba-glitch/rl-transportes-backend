import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { foldComparable, onlyDigits } from '../common/address/address-normalizer';
import { AddressInvalidException } from '../common/address/exceptions/address-invalid.exception';
import { IbgeService } from '../common/address/ibge.service';
import type { ViaCepResponse } from '../common/address/types/via-cep.types';
import { ObservabilityBridgeService } from '../observability/observability-bridge.service';
import { RedisService } from '../redis/redis.service';
import type { CepCacheMetricsSnapshot, CepResponseDto } from './dto/cep-response.dto';

const REDIS_KEY_PREFIX = 'cep:';
const METRICS_KEY = 'cep-cache:metrics';
const DEFAULT_TTL_SEC = 86_400;
const VIACEP_TIMEOUT_MS = 12_000;
const AVISO_PARCIAL =
  'Não foi possível validar o CEP automaticamente — continue normalmente.';

@Injectable()
export class CepCacheService {
  private readonly logger = new Logger(CepCacheService.name);
  private readonly ttlSec: number;
  private readonly providerBaseUrl: string;

  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly ibge: IbgeService,
    @Optional() private readonly observability?: ObservabilityBridgeService,
  ) {
    this.ttlSec = Number(this.config.get<string>('CACHE_CEP_TTL') ?? DEFAULT_TTL_SEC) || DEFAULT_TTL_SEC;
    const base =
      this.config.get<string>('CEP_PROVIDER_URL')?.trim() || 'https://viacep.com.br/ws';
    this.providerBaseUrl = base.replace(/\/$/, '');
  }

  async getCep(cepRaw: string): Promise<CepResponseDto> {
    const cep = onlyDigits(cepRaw);
    if (!/^\d{8}$/.test(cep)) {
      await this.bumpMetric('invalidFormat');
      this.emitObs('CEP_INVALID_FORMAT', { cep: cepRaw });
      throw new AddressInvalidException('CEP deve ter 8 dígitos.');
    }

    const cacheKey = `${REDIS_KEY_PREFIX}${cep}`;
    const cached = await this.redis.safeGet<Omit<CepResponseDto, 'fromCache'>>(cacheKey);
    if (cached) {
      await this.bumpMetric('hits');
      this.emitObs('CEP_CACHE_HIT', { cep });
      return { ...cached, fromCache: true };
    }

    await this.bumpMetric('miss');
    this.emitObs('CEP_CACHE_MISS', { cep });

    const via = await this.fetchFromViaCep(cep);
    const built = await this.buildResponse(cep, via);

    if (via.erro) {
      await this.bumpMetric('fail');
      this.emitObs('CEP_CACHE_FAIL', { cep });
    }

    try {
      const toCache = { ...built, fromCache: undefined };
      await this.redis.safeSet(cacheKey, toCache, this.ttlSec);
    } catch (e) {
      this.logger.warn(`Falha ao gravar cache CEP ${cep}: ${(e as Error).message}`);
    }

    return { ...built, fromCache: false };
  }

  async fetchFromViaCep(cep8: string): Promise<ViaCepResponse> {
    const url = `${this.providerBaseUrl}/${cep8}/json/`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), VIACEP_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        this.logger.warn(`ViaCEP HTTP ${res.status} para ${cep8}`);
        return { erro: true };
      }
      const data = (await res.json()) as ViaCepResponse;
      return this.sanitizeViaCep(data);
    } catch (e) {
      this.logger.warn(`ViaCEP indisponível (${cep8}): ${(e as Error).message}`);
      return { erro: true };
    } finally {
      clearTimeout(timer);
    }
  }

  async getMetrics(): Promise<CepCacheMetricsSnapshot & { total: number }> {
    const raw = await this.redis.hgetall(METRICS_KEY);
    const hits = Number(raw.hits ?? 0);
    const miss = Number(raw.miss ?? 0);
    const fail = Number(raw.fail ?? 0);
    const invalidFormat = Number(raw.invalidFormat ?? 0);
    return {
      hits,
      miss,
      fail,
      invalidFormat,
      total: hits + miss + fail + invalidFormat,
      ttlSeconds: this.ttlSec,
      ttlMediaSegundos: this.ttlSec,
    };
  }

  private sanitizeViaCep(data: ViaCepResponse): ViaCepResponse {
    return {
      ...data,
      cep: data.cep ? onlyDigits(data.cep) : data.cep,
      logradouro: data.logradouro?.trim() || undefined,
      bairro: data.bairro?.trim() || undefined,
      localidade: data.localidade?.trim() || undefined,
      uf: data.uf?.trim().toUpperCase() || undefined,
      ibge: data.ibge?.trim() || undefined,
    };
  }

  private async buildResponse(cep: string, via: ViaCepResponse): Promise<CepResponseDto> {
    const logradouro = nonEmpty(via.logradouro) ?? null;
    const bairro = nonEmpty(via.bairro) ?? null;
    const cidade = nonEmpty(via.localidade) ?? null;
    const uf = via.uf?.trim().toUpperCase() || null;

    if (via.erro || !cidade || !uf) {
      return {
        cepValido: false,
        cep,
        logradouro,
        bairro,
        cidade,
        uf,
        ibge: null,
        aviso: AVISO_PARCIAL,
      };
    }

    const ibge = await this.resolveIbgeForViaCep(via.ibge, cidade, uf);
    if (!ibge) {
      return {
        cepValido: false,
        cep,
        logradouro,
        bairro,
        cidade,
        uf,
        ibge: null,
        aviso: AVISO_PARCIAL,
      };
    }

    return {
      cepValido: true,
      cep,
      logradouro,
      bairro,
      cidade,
      uf,
      ibge,
      aviso: null,
    };
  }

  private normalizeIbgeDigits(raw?: string): string | null {
    let ibge = onlyDigits(raw ?? '');
    if (!ibge) return null;
    if (ibge.length > 7) ibge = ibge.slice(-7);
    if (ibge.length < 7) ibge = ibge.padStart(7, '0');
    if (ibge.length !== 7 || ibge === '0000000') return null;
    return ibge;
  }

  private async resolveIbgeForViaCep(
    ibgeVia: string | undefined,
    cidade: string,
    uf: string,
  ): Promise<string | null> {
    let ibge = this.normalizeIbgeDigits(ibgeVia);
    if (ibge) {
      const row = await this.ibge.assertIbgeValid(ibge, uf, foldComparable(cidade));
      if (row) return ibge;
    }
    return this.resolveIbgeFromNomeUf(cidade, uf);
  }

  private async resolveIbgeFromNomeUf(nomeCidade: string, uf: string): Promise<string | null> {
    const list = await this.ibge.getMunicipios();
    const want = foldComparable(nomeCidade);
    const row = list.find((m) => m.uf === uf.toUpperCase() && foldComparable(m.nome) === want);
    return row?.codigoIbge ?? null;
  }

  private async bumpMetric(field: 'hits' | 'miss' | 'fail' | 'invalidFormat'): Promise<void> {
    try {
      await this.redis.hincrby(METRICS_KEY, field, 1);
    } catch {
      /* métrica best-effort */
    }
  }

  private emitObs(tipo: string, contexto: Record<string, unknown>): void {
    this.observability?.emit({
      type: 'FALLBACK_EVENT',
      payload: { tipo, ...contexto, at: new Date().toISOString() },
    });
  }
}

function nonEmpty(s?: string): string | undefined {
  const t = s?.trim();
  return t ? t : undefined;
}
