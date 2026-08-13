import { EventoGatilhoTarifa, StatusContainerTarifa, TipoContainerTarifa } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { diffDiasCalendario } from '../armazenagem-faturamento/armazenagem-billing.util';
import {
  assertTabelaPrecoConfigurada,
  calculateReeferSurcharge,
  evaluateBillingRules,
  computeDiasEnergiaFromTomadaEvents,
  inferTipoContainer,
  legacyTarifaToRegras,
  pickRegra,
  reeferEnergyFactor,
} from './billing-rule-engine.util';

describe('billing-rule-engine.util', () => {
  const gateIn = new Date('2026-06-01T10:00:00.000Z');

  const regras = [
    {
      id: 'r-gi',
      eventoGatilho: EventoGatilhoTarifa.GATE_IN,
      tipoContainer: TipoContainerTarifa.TODOS,
      statusContainer: StatusContainerTarifa.AMBOS,
      valor: new Prisma.Decimal(150),
      diasFreeTime: 0,
      ativa: true,
      nome: 'Gate-In',
    },
    {
      id: 'r-go',
      eventoGatilho: EventoGatilhoTarifa.GATE_OUT,
      tipoContainer: TipoContainerTarifa.TODOS,
      statusContainer: StatusContainerTarifa.AMBOS,
      valor: new Prisma.Decimal(120),
      diasFreeTime: 0,
      ativa: true,
      nome: 'Gate-Out',
    },
    {
      id: 'r-dry',
      eventoGatilho: EventoGatilhoTarifa.DIARIA_ARMAZENAGEM,
      tipoContainer: TipoContainerTarifa.TODOS,
      statusContainer: StatusContainerTarifa.AMBOS,
      valor: new Prisma.Decimal(85),
      diasFreeTime: 5,
      ativa: true,
      nome: 'Diária dry',
    },
    {
      id: 'r-reefer',
      eventoGatilho: EventoGatilhoTarifa.DIARIA_ARMAZENAGEM,
      tipoContainer: TipoContainerTarifa.REEFER,
      statusContainer: StatusContainerTarifa.AMBOS,
      valor: new Prisma.Decimal(170),
      diasFreeTime: 3,
      ativa: true,
      nome: 'Diária reefer',
    },
  ];

  it('inferTipoContainer detecta reefer e IMO', () => {
    expect(inferTipoContainer({ tamanho: '40', tipo: 'DRY', refrigerado: false })).toBe(
      TipoContainerTarifa.DRY_40,
    );
    expect(inferTipoContainer({ tamanho: '20', tipo: 'DRY', refrigerado: true })).toBe(
      TipoContainerTarifa.REEFER,
    );
    expect(inferTipoContainer({ tamanho: '40', tipo: 'IMO PERIGOSA', refrigerado: false })).toBe(
      TipoContainerTarifa.IMO_PERIGOSA,
    );
  });

  it('pickRegra prefere tipo específico sobre TODOS', () => {
    const picked = pickRegra(regras, TipoContainerTarifa.REEFER, EventoGatilhoTarifa.DIARIA_ARMAZENAGEM);
    expect(picked?.id).toBe('r-reefer');
  });

  it('PR-02: diffDiasCalendario conta fim de semana (sexta→segunda = 3 dias)', () => {
    const sexta = new Date('2026-07-03T10:00:00.000Z'); // sexta
    const segunda = new Date('2026-07-06T10:00:00.000Z'); // segunda
    expect(diffDiasCalendario(sexta, segunda)).toBe(3);
  });

  it('PR-03: pickRegra prefere status CHEIO sobre AMBOS', () => {
    const regrasStatus = [
      ...regras,
      {
        id: 'r-cheio',
        eventoGatilho: EventoGatilhoTarifa.DIARIA_ARMAZENAGEM,
        tipoContainer: TipoContainerTarifa.DRY_40,
        statusContainer: StatusContainerTarifa.CHEIO,
        valor: new Prisma.Decimal(95),
        diasFreeTime: 3,
        ativa: true,
        nome: 'Diária cheio',
      },
      {
        id: 'r-ambos',
        eventoGatilho: EventoGatilhoTarifa.DIARIA_ARMAZENAGEM,
        tipoContainer: TipoContainerTarifa.DRY_40,
        statusContainer: StatusContainerTarifa.AMBOS,
        valor: new Prisma.Decimal(85),
        diasFreeTime: 5,
        ativa: true,
        nome: 'Diária ambos',
      },
    ];
    const picked = pickRegra(
      regrasStatus as never,
      TipoContainerTarifa.DRY_40,
      EventoGatilhoTarifa.DIARIA_ARMAZENAGEM,
      StatusContainerTarifa.CHEIO,
    );
    expect(picked?.id).toBe('r-cheio');
    expect(picked?.diasFreeTime).toBe(3);
  });

  it('PR-03: pricingOverrides aplicam free time e tarifa do item cadastral', () => {
    const asOf = new Date('2026-06-10T10:00:00.000Z');
    const result = evaluateBillingRules({
      gateInAt: gateIn,
      asOf,
      regras: regras as never,
      container: { tamanho: '40', tipo: 'DRY', statusContainer: StatusContainerTarifa.CHEIO },
      incluirGateIn: false,
      incluirGateOut: false,
      pricingOverrides: { diasFreeTime: 0, valorDiaria: 15 },
    });
    expect(result.diasNoPatio).toBe(9);
    expect(result.diasFaturaveis).toBe(9);
    const diaria = result.items.find((i) => i.eventoGatilho === EventoGatilhoTarifa.DIARIA_ARMAZENAGEM);
    expect(diaria?.valorUnitario).toBe(15);
    expect(diaria?.valorTotal).toBe(135);
  });

  it('não cobra diária dentro do free time', () => {
    const asOf = new Date('2026-06-05T10:00:00.000Z');
    const result = evaluateBillingRules({
      gateInAt: gateIn,
      asOf,
      regras: regras as never,
      container: { tamanho: '40', tipo: 'DRY' },
      incluirGateIn: true,
      incluirGateOut: false,
    });
    expect(result.diasNoPatio).toBe(4);
    expect(result.diasFaturaveis).toBe(0);
    expect(result.items.some((i) => i.eventoGatilho === EventoGatilhoTarifa.DIARIA_ARMAZENAGEM)).toBe(
      false,
    );
    expect(result.valorTotal).toBe(150);
  });

  it('cobra diárias após free time + gate fees no fechamento', () => {
    const asOf = new Date('2026-06-10T10:00:00.000Z');
    const result = evaluateBillingRules({
      gateInAt: gateIn,
      asOf,
      regras: regras as never,
      container: { tamanho: '40', tipo: 'DRY' },
      incluirGateIn: true,
      incluirGateOut: true,
    });
    expect(result.diasFaturaveis).toBe(4);
    const diaria = result.items.find((i) => i.eventoGatilho === EventoGatilhoTarifa.DIARIA_ARMAZENAGEM);
    expect(diaria?.quantidade).toBe(4);
    expect(diaria?.valorTotal).toBe(340);
    expect(result.valorTotal).toBe(610);
  });

  it('legacyTarifaToRegras gera diária sintética', () => {
    const legacy = legacyTarifaToRegras({ freeTimeDias: 5, valorDiaria: 85, valorServicosExtras: 120 });
    expect(legacy).toHaveLength(2);
    expect(legacy[0].eventoGatilho).toBe(EventoGatilhoTarifa.DIARIA_ARMAZENAGEM);
  });

  it('calculateReeferSurcharge aplica fator por set point', () => {
    expect(reeferEnergyFactor(-18)).toBe(1.5);
    expect(reeferEnergyFactor(-5)).toBe(1.2);
    expect(reeferEnergyFactor(5)).toBe(1);
    expect(calculateReeferSurcharge(10, -18, 45)).toBe(675);
    expect(calculateReeferSurcharge(10, -5, 45)).toBe(540);
    expect(calculateReeferSurcharge(10, 5, 45)).toBe(450);
  });

  it('evaluateBillingRules inclui ENERGIA_REEFER para contêiner refrigerado', () => {
    const asOf = new Date('2026-06-10T10:00:00.000Z');
    const result = evaluateBillingRules({
      gateInAt: gateIn,
      asOf,
      regras: regras as never,
      container: { tamanho: '40', tipo: 'REEFER', refrigerado: true, setPoint: -18 },
      incluirGateIn: false,
      incluirGateOut: false,
    });
    const energia = result.items.find((i) => i.eventoGatilho === EventoGatilhoTarifa.ENERGIA_REEFER);
    expect(energia).toBeDefined();
    expect(energia?.valorTotal).toBeGreaterThan(0);
  });

  it('evaluateBillingRules NÃO cobra energia se reefer sem tomada (refrigerado=false)', () => {
    const asOf = new Date('2026-06-10T10:00:00.000Z');
    const result = evaluateBillingRules({
      gateInAt: gateIn,
      asOf,
      regras: regras as never,
      container: { tamanho: '40', tipo: 'REEFER', refrigerado: false, setPoint: null },
      incluirGateIn: false,
      incluirGateOut: false,
    });
    const energia = result.items.find((i) => i.eventoGatilho === EventoGatilhoTarifa.ENERGIA_REEFER);
    expect(energia).toBeUndefined();
  });

  it('evaluateBillingRules usa diasEnergiaReefer (prorata da tomada)', () => {
    const asOf = new Date('2026-06-10T10:00:00.000Z');
    const result = evaluateBillingRules({
      gateInAt: gateIn,
      asOf,
      regras: regras as never,
      container: { tamanho: '40', tipo: 'REEFER', refrigerado: false, setPoint: -18 },
      diasEnergiaReefer: 3,
      incluirGateIn: false,
      incluirGateOut: false,
    });
    const energia = result.items.find((i) => i.eventoGatilho === EventoGatilhoTarifa.ENERGIA_REEFER);
    expect(energia?.quantidade).toBe(3);
  });

  it('assertTabelaPrecoConfigurada exige diária ativa', () => {
    expect(() => assertTabelaPrecoConfigurada(null, TipoContainerTarifa.DRY_40)).toThrow(
      /Tabela de preço não configurada/,
    );
    expect(() =>
      assertTabelaPrecoConfigurada({ ativa: true, regras: [] }, TipoContainerTarifa.DRY_40),
    ).toThrow(/Tabela de preço não configurada/);
  });
});
