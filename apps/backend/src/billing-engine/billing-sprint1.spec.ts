import { EventoGatilhoTarifa, Prisma, StatusContainerTarifa, TipoContainerTarifa } from '@prisma/client';
import { diffDiasCalendario } from '../armazenagem-faturamento/armazenagem-billing.util';
import { FAIXAS_DIARIA_PADRAO } from './faixa-diaria-calculator';
import { evaluateBillingRules, pickRegra } from './billing-rule-engine.util';

describe('Billing Sprint 1 — Diárias Corridas + Free Time Dinâmico', () => {
  const mkRegra = (
    id: string,
    tipo: TipoContainerTarifa,
    status: StatusContainerTarifa,
    freeTime: number,
    valor: number,
  ) => ({
    id,
    eventoGatilho: EventoGatilhoTarifa.DIARIA_ARMAZENAGEM,
    tipoContainer: tipo,
    statusContainer: status,
    valor: new Prisma.Decimal(valor),
    diasFreeTime: freeTime,
    ativa: true,
    nome: id,
  });

  it('PR-02: contêiner sexta→segunda = 3 diárias cobráveis (free time 0)', () => {
    const gateIn = new Date('2026-07-03T10:00:00.000Z');
    const gateOut = new Date('2026-07-06T10:00:00.000Z');
    expect(diffDiasCalendario(gateIn, gateOut)).toBe(3);

    const result = evaluateBillingRules({
      gateInAt: gateIn,
      asOf: gateOut,
      regras: [mkRegra('r1', TipoContainerTarifa.TODOS, StatusContainerTarifa.AMBOS, 0, 15)] as never,
      container: { tamanho: '40', tipo: 'DRY' },
      incluirGateIn: false,
      incluirGateOut: false,
      pricingOverrides: { diasFreeTime: 0, valorDiaria: 15 },
    });

    expect(result.diasNoPatio).toBe(3);
    expect(result.diasFaturaveis).toBe(3);
    expect(result.valorTotal).toBe(45);
  });

  it('PR-03: hierarquia específica CHEIO vence AMBOS', () => {
    const regras = [
      mkRegra('especifica', TipoContainerTarifa.DRY_20, StatusContainerTarifa.CHEIO, 3, 20),
      mkRegra('ambos', TipoContainerTarifa.DRY_20, StatusContainerTarifa.AMBOS, 5, 15),
      mkRegra('global', TipoContainerTarifa.TODOS, StatusContainerTarifa.AMBOS, 7, 10),
    ];
    const picked = pickRegra(
      regras as never,
      TipoContainerTarifa.DRY_20,
      EventoGatilhoTarifa.DIARIA_ARMAZENAGEM,
      StatusContainerTarifa.CHEIO,
    );
    expect(picked?.id).toBe('especifica');
    expect(picked?.diasFreeTime).toBe(3);
  });

  it('PR-03: container VAZIO usa regra AMBOS quando não há específica', () => {
    const regras = [
      mkRegra('cheio', TipoContainerTarifa.DRY_20, StatusContainerTarifa.CHEIO, 3, 20),
      mkRegra('ambos', TipoContainerTarifa.DRY_20, StatusContainerTarifa.AMBOS, 7, 15),
    ];
    const picked = pickRegra(
      regras as never,
      TipoContainerTarifa.DRY_20,
      EventoGatilhoTarifa.DIARIA_ARMAZENAGEM,
      StatusContainerTarifa.VAZIO,
    );
    expect(picked?.id).toBe('ambos');
    expect(picked?.diasFreeTime).toBe(7);
  });

  it('PR-02+03: 9 dias com free time 7 → 2 diárias × R$20', () => {
    const gateIn = new Date('2026-06-01T08:00:00.000Z');
    const gateOut = new Date('2026-06-10T08:00:00.000Z');
    const result = evaluateBillingRules({
      gateInAt: gateIn,
      asOf: gateOut,
      regras: [
        mkRegra('ambos', TipoContainerTarifa.DRY_20, StatusContainerTarifa.AMBOS, 7, 20),
      ] as never,
      container: { tamanho: '20', tipo: 'DRY', statusContainer: StatusContainerTarifa.VAZIO },
      incluirGateIn: false,
      incluirGateOut: false,
    });
    expect(result.diasFaturaveis).toBe(2);
    expect(result.valorTotal).toBe(40);
  });

  it('faixas escalonadas: 7 free + 18 dias = R$ 375 + handling no gate-out', () => {
    const gateIn = new Date('2026-06-01T08:00:00.000Z');
    const gateOut = new Date('2026-06-19T08:00:00.000Z');
    const regras = [
      {
        id: 'handling',
        eventoGatilho: EventoGatilhoTarifa.HANDLING,
        tipoContainer: TipoContainerTarifa.DRY_40,
        tipoContainerCodigo: 'DRY',
        capacidadeCodigo: 'DC',
        containerTamanho: "40'",
        statusContainer: StatusContainerTarifa.CHEIO,
        valor: new Prisma.Decimal(150),
        diasFreeTime: 0,
        faixasDiaria: null,
        ativa: true,
        nome: 'Handling',
      },
      {
        id: 'diaria',
        eventoGatilho: EventoGatilhoTarifa.DIARIA_ARMAZENAGEM,
        tipoContainer: TipoContainerTarifa.DRY_40,
        tipoContainerCodigo: 'DRY',
        capacidadeCodigo: 'DC',
        containerTamanho: "40'",
        statusContainer: StatusContainerTarifa.CHEIO,
        valor: new Prisma.Decimal(30),
        diasFreeTime: 7,
        faixasDiaria: FAIXAS_DIARIA_PADRAO,
        ativa: true,
        nome: 'Diária',
      },
    ];
    const result = evaluateBillingRules({
      gateInAt: gateIn,
      asOf: gateOut,
      regras: regras as never,
      container: {
        tamanho: '40',
        tipo: 'DRY',
        capacidade: 'DC',
        statusContainer: StatusContainerTarifa.CHEIO,
      },
      incluirGateIn: false,
      incluirGateOut: true,
      pricingOverrides: { diasFreeTime: 7, faixasDiaria: FAIXAS_DIARIA_PADRAO },
    });
    expect(diffDiasCalendario(gateIn, gateOut)).toBe(18);
    expect(result.diasFaturaveis).toBe(11);
    const handling = result.items.find((i) => i.eventoGatilho === EventoGatilhoTarifa.HANDLING);
    const diaria = result.items.find((i) => i.eventoGatilho === EventoGatilhoTarifa.DIARIA_ARMAZENAGEM);
    expect(handling?.valorTotal).toBe(150);
    expect(diaria?.valorTotal).toBe(375);
    expect(result.valorTotal).toBe(525);
  });
});
