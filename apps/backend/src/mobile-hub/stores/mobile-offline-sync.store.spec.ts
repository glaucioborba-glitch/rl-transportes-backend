import { MobileOfflineSyncStore } from './mobile-offline-sync.store';

describe('MobileOfflineSyncStore', () => {
  it('resolverLww escolhe maior clientTs', () => {
    const store = new MobileOfflineSyncStore({} as never, {} as never);
    const a = {
      id: 'a',
      deviceId: 'd',
      userSub: 'u',
      op: 'gate_in' as const,
      body: { protocolo: 'P' },
      clientTs: 10,
      recebidoEm: new Date().toISOString(),
      synced: false,
    };
    const b = { ...a, id: 'b', clientTs: 50 };
    const w = store.resolverLww([a, b]);
    expect(w.id).toBe('b');
  });
});
