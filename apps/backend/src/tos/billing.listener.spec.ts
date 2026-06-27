import { Test, TestingModule } from '@nestjs/testing';
import { BillingListener } from './billing.listener';
import { TosEventEmitter } from './tos-event-emitter';

describe('BillingListener', () => {
  it('inicializa sem handler síncrono de faturamento (outbox worker)', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BillingListener, TosEventEmitter],
    }).compile();

    const listener = module.get(BillingListener);
    listener.onModuleInit();
    expect(listener).toBeDefined();
  });
});
