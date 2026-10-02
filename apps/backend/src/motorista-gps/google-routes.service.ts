import { Injectable, Logger } from '@nestjs/common';
import { EmpresaOperadoraService } from '../tenant/empresa-operadora.service';
import { IntegrationCredentialsService } from '../tenant/integration-credentials.service';
import { DEFAULT_TENANT_ID } from '../tenant/tenant.constants';
import { TenantContextService } from '../tenant/tenant-context.service';
import {
  ITAJAI_TERMINAL,
  arredondarCoordCache,
  chaveDestinoRota,
  minutosDeSegundos,
  montarEnderecoTerminal,
  parseGoogleDurationSeconds,
  type DestinoTerminal,
} from './google-routes.util';

type MapaItemEta = {
  origem: string;
  cadastroId: string;
  lat: number | null;
  lng: number | null;
  etaMinutos?: number | null;
  etaAt?: string | null;
  distanciaM?: number | null;
  rotaPolyline?: string | null;
};

const ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const FIELD_MASK = 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline';
const CACHE_TTL_MS = 90_000;
const FAIL_TTL_MS = 5 * 60_000;

type RouteEta = {
  etaMinutos: number;
  etaAt: string;
  distanciaM: number;
  polyline: string | null;
};

type CacheEntry = { at: number; ttl: number; value: RouteEta | null };

type ComputeRoutesResponse = {
  routes?: Array<{
    duration?: string;
    distanceMeters?: number;
    polyline?: { encodedPolyline?: string };
  }>;
  error?: { message?: string; status?: string };
};

@Injectable()
export class GoogleRoutesService {
  private readonly logger = new Logger(GoogleRoutesService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private destinoCache: { at: number; value: DestinoTerminal } | null = null;
  private warnedMissingKey = false;
  private warnedFail: string | null = null;

  constructor(
    private readonly empresa: EmpresaOperadoraService,
    private readonly tenantContext: TenantContextService,
    private readonly integrationCreds: IntegrationCredentialsService,
  ) {}

  async enriquecerComEta(items: MapaItemEta[], destinoOverride?: DestinoTerminal): Promise<void> {
    const routes = await this.integrationCreds.resolveGoogleRoutes();
    if (!routes.apiKey) {
      if (!this.warnedMissingKey) {
        this.warnedMissingKey = true;
        this.logger.warn('GOOGLE_ROUTES_API_KEY ausente — mapa sem ETA.');
      }
      return;
    }
    const alvos = items.filter((i) => i.lat != null && i.lng != null);
    if (alvos.length === 0) return;
    const destino = destinoOverride ?? (await this.resolverDestino());
    await Promise.all(
      alvos.map(async (item) => {
        const eta = await this.etaAteDestino(
          item.lat as number,
          item.lng as number,
          item.origem,
          item.cadastroId,
          destino,
        );
        if (!eta) return;
        item.etaMinutos = eta.etaMinutos;
        item.etaAt = eta.etaAt;
        item.distanciaM = eta.distanciaM;
        item.rotaPolyline = eta.polyline;
      }),
    );
  }

  private async apiKey(): Promise<string> {
    const routes = await this.integrationCreds.resolveGoogleRoutes();
    return routes.apiKey ?? '';
  }

  private tenantId(): string {
    return this.tenantContext.getTenantId()?.trim() || DEFAULT_TENANT_ID;
  }

  private async resolverDestino(): Promise<DestinoTerminal> {
    const now = Date.now();
    if (this.destinoCache && now - this.destinoCache.at < 10 * 60_000) return this.destinoCache.value;

    const maps = await this.integrationCreds.resolveGoogleMaps();
    const lat = maps.terminalLat;
    const lng = maps.terminalLng;
    if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
      const value: DestinoTerminal = { kind: 'latLng', lat, lng };
      this.destinoCache = { at: now, value };
      return value;
    }

    try {
      const dados = await this.empresa.obter(this.tenantId());
      const address = montarEnderecoTerminal(dados);
      if (address) {
        const value: DestinoTerminal = { kind: 'address', address };
        this.destinoCache = { at: now, value };
        return value;
      }
    } catch (e) {
      this.logger.warn(`Não li o endereço da empresa para o ETA: ${e instanceof Error ? e.message : e}`);
    }

    const value: DestinoTerminal = { kind: 'latLng', ...ITAJAI_TERMINAL };
    this.destinoCache = { at: now, value };
    return value;
  }

  private async etaAteDestino(
    lat: number,
    lng: number,
    origem: string,
    cadastroId: string,
    destino: DestinoTerminal,
  ): Promise<RouteEta | null> {
    const cacheKey = `${origem}:${cadastroId}:${arredondarCoordCache(lat)}:${arredondarCoordCache(lng)}:${chaveDestinoRota(destino)}`;
    const hit = this.cache.get(cacheKey);
    const now = Date.now();
    if (hit && now - hit.at < hit.ttl) return hit.value;

    const value = await this.computeRoute(lat, lng, destino);
    this.cache.set(cacheKey, {
      at: now,
      ttl: value ? CACHE_TTL_MS : FAIL_TTL_MS,
      value,
    });
    return value;
  }

  private async computeRoute(lat: number, lng: number, destino: DestinoTerminal): Promise<RouteEta | null> {
    const key = await this.apiKey();
    const destination =
      destino.kind === 'address'
        ? { address: destino.address }
        : { location: { latLng: { latitude: destino.lat, longitude: destino.lng } } };

    try {
      const res = await fetch(ROUTES_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': FIELD_MASK,
        },
        body: JSON.stringify({
          origin: { location: { latLng: { latitude: lat, longitude: lng } } },
          destination,
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_AWARE',
          languageCode: 'pt-BR',
          units: 'METRIC',
        }),
        signal: AbortSignal.timeout(8_000),
      });
      const json = (await res.json()) as ComputeRoutesResponse;
      if (!res.ok) {
        const msg = json.error?.message ?? `HTTP ${res.status}`;
        if (this.warnedFail !== msg) {
          this.warnedFail = msg;
          this.logger.warn(`Routes API recusou o ETA: ${msg}`);
        }
        return null;
      }
      const route = json.routes?.[0];
      const seconds = parseGoogleDurationSeconds(route?.duration);
      if (seconds == null) return null;
      const etaMinutos = minutosDeSegundos(seconds);
      return {
        etaMinutos,
        etaAt: new Date(Date.now() + seconds * 1000).toISOString(),
        distanciaM: route?.distanceMeters ?? 0,
        polyline: route?.polyline?.encodedPolyline ?? null,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (this.warnedFail !== msg) {
        this.warnedFail = msg;
        this.logger.warn(`Falha ao consultar Routes API: ${msg}`);
      }
      return null;
    }
  }
}
