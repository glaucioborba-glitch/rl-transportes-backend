import { MobileOfflineSyncStore } from './mobile-offline-sync.store';

describe('MobileOfflineSyncStore', () => {
  it('resolverLww escolhe maior clientTs', () => {
    const store = new MobileOfflineSyncStore();
    const a = store.enfileirar({
      deviceId: 'd',
      userSub: 'u',
      op: 'gate_in',
      body: { protocolo: 'P' },
      clientTs: 10,
    });
    const b = store.enfileirar({
      deviceId: 'd',
      userSub: 'u',
      op: 'gate_in',
      body: { protocolo: 'P' },
      clientTs: 50,
    });
    const w = store.resolverLww([a, b]);
    expect(w.id).toBe(b.id);
  });
});
