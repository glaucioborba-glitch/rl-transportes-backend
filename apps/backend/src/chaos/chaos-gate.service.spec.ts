import { ConfigService } from '@nestjs/config';
import { ChaosGateService } from './chaos-gate.service';

describe('ChaosGateService', () => {
  it('clampDuration respeita máximo 30s', () => {
    const cfg = { get: () => 'development' } as unknown as ConfigService;
    const gate = new ChaosGateService(cfg);
    expect(gate.clampDuration(999_000, 1000)).toBe(30_000);
    expect(gate.clampDuration(50, 2000)).toBe(100);
    expect(gate.clampDuration(NaN, 2000)).toBe(2000);
  });

  it('isChaosEnvironment true em development', () => {
    const cfg = { get: (k: string) => (k === 'NODE_ENV' ? 'development' : undefined) } as unknown as ConfigService;
    const gate = new ChaosGateService(cfg);
    expect(gate.isChaosEnvironment()).toBe(true);
  });
});
