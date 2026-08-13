import { parseQrCredencialPayload } from './gate-qr-payload.util';

describe('parseQrCredencialPayload', () => {
  it('extrai protocolo, container e versao do JSON do QR', () => {
    const raw = JSON.stringify({
      protocolo: 'RL-2026-ABC',
      versao: 2,
      containers: ['MSKU1234567'],
      motorista: 'João',
    });
    expect(parseQrCredencialPayload(raw)).toEqual({
      protocolo: 'RL-2026-ABC',
      container: 'MSKU1234567',
      versao: 2,
    });
  });

  it('retorna null para payload inválido', () => {
    expect(parseQrCredencialPayload('not-json')).toBeNull();
    expect(parseQrCredencialPayload('{}')).toBeNull();
  });
});
