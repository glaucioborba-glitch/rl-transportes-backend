import { GiroEstimado } from '@prisma/client';
import { classifyGiroEstimado, YardAllocationService } from './yard-allocation.service';

describe('classifyGiroEstimado', () => {
  it('0–3 dias → RAPIDO', () => {
    expect(classifyGiroEstimado(0)).toBe(GiroEstimado.RAPIDO);
    expect(classifyGiroEstimado(3)).toBe(GiroEstimado.RAPIDO);
  });

  it('4–7 dias → MEDIO', () => {
    expect(classifyGiroEstimado(4)).toBe(GiroEstimado.MEDIO);
    expect(classifyGiroEstimado(7)).toBe(GiroEstimado.MEDIO);
  });

  it('>7 dias → LENTO', () => {
    expect(classifyGiroEstimado(8)).toBe(GiroEstimado.LENTO);
    expect(classifyGiroEstimado(30)).toBe(GiroEstimado.LENTO);
  });
});

describe('YardAllocationService.computeDiasPermanencia', () => {
  const svc = new YardAllocationService({} as never);

  it('usa previsaoRetirada quando informada', () => {
    const ref = new Date('2026-06-01T12:00:00Z');
    const previsao = new Date('2026-06-05T08:00:00Z');
    const dias = svc.computeDiasPermanencia({
      previsaoRetirada: previsao,
      bookingDeadline: null,
      freeTimeDias: 7,
      referenceAt: ref,
    });
    expect(dias).toBe(4);
  });

  it('usa free time quando datas opcionais ausentes', () => {
    const dias = svc.computeDiasPermanencia({
      previsaoRetirada: null,
      bookingDeadline: null,
      freeTimeDias: 5,
      referenceAt: new Date('2026-06-01T00:00:00Z'),
    });
    expect(dias).toBe(5);
  });
});
