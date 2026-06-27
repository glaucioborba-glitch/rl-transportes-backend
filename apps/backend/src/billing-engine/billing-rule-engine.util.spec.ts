import { EventoGatilhoTarifa, TipoContainerTarifa } from '@prisma/client';
import { Prisma } from '@prisma/client';
import {
  evaluateBillingRules,
  inferTipoContainer,
  legacyTarifaToRegras,
  pickRegra,
} from './billing-rule-engine.util';

describe('billing-rule-engine.util', () => {
  const gateIn = new Date('2026-06-01T10:00:00.000Z');

  const regras = [
    {
      id: 'r-gi',
      eventoGatilho: EventoGatilhoTarifa.GATE_IN,
      tipoContainer: TipoContainerTarifa.TODOS,
      valor: new Prisma.Decimal(150),
      diasFreeTime: 0,
      ativa: true,
      nome: 'Gate-In',
    },
    {
      id: 'r-go',
      eventoGatilho: EventoGatilhoTarifa.GATE_OUT,
      tipoContainer: TipoContainerTarifa.TODOS,
      valor: new Prisma.Decimal(120),
      diasFreeTime: 0,
      ativa: true,
      nome: 'Gate-Out',
    },
    {
      id: 'r-dry',
      eventoGatilho: EventoGatilhoTarifa.DIARIA_ARMAZENAGEM,
      tipoContainer: TipoContainerTarifa.TODOS,
      valor: new Prisma.Decimal(85),
      diasFreeTime: 5,
      ativa: true,
      nome: 'Diária dry',
    },
    {
      id: 'r-reefer',
      eventoGatilho: EventoGatilhoTarifa.DIARIA_ARMAZENAGEM,
      tipoContainer: TipoContainerTarifa.REEFER,
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
});
