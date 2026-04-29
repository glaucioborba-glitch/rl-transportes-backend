import { Test, TestingModule } from '@nestjs/testing';
import { IaPreditivaService } from './ia-preditiva.service';
import { IaPreditivaMlopsStore } from './ia-preditiva-mlops.store';
import { IaPreditivaDemandaService } from './services/ia-preditiva-demanda.service';
import { IaPreditivaOcupacaoService } from './services/ia-preditiva-ocupacao.service';
import { IaPreditivaProdutividadeService } from './services/ia-preditiva-produtividade.service';
import { IaPreditivaInadimplenciaService } from './services/ia-preditiva-inadimplencia.service';

describe('IaPreditivaService', () => {
  let svc: IaPreditivaService;
  let mlopsMock: {
    touchTreino: jest.Mock;
    persistirOpcional: jest.Mock;
    versao: string;
    ultimaAtualizacao: string | null;
    qualidadeProxyPct: number;
    pesosInadimplencia: number[];
    ocupacaoPhi: number;
    sesAlpha: number;
    blendTrend: number;
    prodHorasEfectivasPorDia: number;
  };

  beforeEach(async () => {
    mlopsMock = {
      touchTreino: jest.fn(),
      persistirOpcional: jest.fn(() => ({ ok: false })),
      versao: 'test',
      ultimaAtualizacao: null,
      qualidadeProxyPct: 70,
      pesosInadimplencia: [1.8, 0.35, -0.25],
      ocupacaoPhi: 0.8,
      sesAlpha: 0.35,
      blendTrend: 0.62,
      prodHorasEfectivasPorDia: 16,
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IaPreditivaService,
        { provide: IaPreditivaMlopsStore, useValue: mlopsMock },
        {
          provide: IaPreditivaDemandaService,
          useValue: { treinar: jest.fn(async () => ({ mesesUsados: 24, cv: 0.2 })) },
        },
        {
          provide: IaPreditivaOcupacaoService,
          useValue: { treinar: jest.fn(async () => ({ phi: 0.8 })) },
        },
        {
          provide: IaPreditivaProdutividadeService,
          useValue: { treinar: jest.fn(async () => ({ horasDia: 16 })) },
        },
        {
          provide: IaPreditivaInadimplenciaService,
          useValue: { treinar: jest.fn(async () => ({ pesos: [1, 0, 0] })) },
        },
      ],
    }).compile();

    svc = module.get(IaPreditivaService);
  });

  it('treinar() agrega sub-modelos e dispara touchTreino', async () => {
    const out = await svc.treinar();
    expect(out.demanda.mesesUsados).toBe(24);
    expect(out.ocupacao.phi).toBe(0.8);
    expect(out.persistencia.ok).toBe(false);
    expect(mlopsMock.touchTreino).toHaveBeenCalled();
  });

  it('modelos() expõe catálogo', () => {
    const m = svc.modelos();
    expect(m.modelos.length).toBeGreaterThanOrEqual(4);
    expect(m.modelos.some((x) => x.id === 'demanda_volume')).toBe(true);
  });
});
