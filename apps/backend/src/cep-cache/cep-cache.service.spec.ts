import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AddressInvalidException } from '../common/address/exceptions/address-invalid.exception';
import { IbgeService } from '../common/address/ibge.service';
import { ObservabilityBridgeService } from '../observability/observability-bridge.service';
import { RedisService } from '../redis/redis.service';
import { CepCacheService } from './cep-cache.service';

describe('CepCacheService', () => {
  let service: CepCacheService;
  let redis: {
    get: jest.Mock;
    setex: jest.Mock;
    del: jest.Mock;
    hincrby: jest.Mock;
    hgetall: jest.Mock;
  };
  let ibge: { assertIbgeValid: jest.Mock; getMunicipios: jest.Mock };
  let observability: { emit: jest.Mock };
  let fetchMock: jest.SpyInstance;

  beforeEach(async () => {
    redis = {
      get: jest.fn().mockResolvedValue(null),
      setex: jest.fn().mockResolvedValue(undefined),
      del: jest.fn(),
      hincrby: jest.fn().mockResolvedValue(1),
      hgetall: jest.fn().mockResolvedValue({ hits: '2', miss: '1', fail: '0', invalidFormat: '0' }),
    };
    ibge = {
      assertIbgeValid: jest.fn().mockResolvedValue({ codigoIbge: '4205407' }),
      getMunicipios: jest.fn().mockResolvedValue([
        { codigoIbge: '4205407', nome: 'Florianópolis', uf: 'SC' },
      ]),
    };
    observability = { emit: jest.fn() };

    const mod = await Test.createTestingModule({
      providers: [
        CepCacheService,
        { provide: RedisService, useValue: redis },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'CACHE_CEP_TTL') return '86400';
              if (key === 'CEP_PROVIDER_URL') return 'https://viacep.com.br/ws';
              return undefined;
            },
          },
        },
        { provide: IbgeService, useValue: ibge },
        { provide: ObservabilityBridgeService, useValue: observability },
      ],
    }).compile();

    service = mod.get(CepCacheService);
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('CEP existente consulta ViaCEP 1x e grava Redis; segunda chamada usa cache', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        logradouro: 'Rua Teste',
        bairro: 'Centro',
        localidade: 'Florianópolis',
        uf: 'SC',
        ibge: '4205407',
      }),
    });

    const first = await service.getCep('88010000');
    expect(first.cepValido).toBe(true);
    expect(first.fromCache).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(redis.setex).toHaveBeenCalledWith('cep:88010000', 86400, expect.any(String));

    redis.get.mockResolvedValueOnce(JSON.stringify({ ...first, fromCache: undefined }));
    const second = await service.getCep('88010000');
    expect(second.fromCache).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(redis.hincrby).toHaveBeenCalledWith('cep-cache:metrics', 'hits', 1);
  });

  it('CEP inexistente não lança exceção — retorna cepValido false', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ erro: true }),
    });

    const r = await service.getCep('99999999');
    expect(r.cepValido).toBe(false);
    expect(r.ibge).toBeNull();
  });

  it('ViaCEP indisponível retorna fallback sem erro', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    const r = await service.getCep('88010000');
    expect(r.cepValido).toBe(false);
    expect(r.aviso).toContain('continue normalmente');
    expect(redis.hincrby).toHaveBeenCalledWith('cep-cache:metrics', 'fail', 1);
  });

  it('formato inválido lança AddressInvalidException', async () => {
    await expect(service.getCep('123')).rejects.toBeInstanceOf(AddressInvalidException);
    expect(redis.hincrby).toHaveBeenCalledWith('cep-cache:metrics', 'invalidFormat', 1);
  });

  it('getMetrics expõe hits, miss e TTL', async () => {
    const m = await service.getMetrics();
    expect(m.hits).toBe(2);
    expect(m.miss).toBe(1);
    expect(m.ttlSeconds).toBe(86400);
  });
});
