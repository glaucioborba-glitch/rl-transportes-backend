import { parseQrCredencialPayload } from './gate-qr-payload.util';

describe('parseQrCredencialPayload', () => {
  it('extrai protocolo e token do QR unificado', () => {
    const raw = JSON.stringify({ protocolo: 'RL-2026-ABC', token: 'tok-1' });
    expect(parseQrCredencialPayload(raw)).toEqual({
      protocolo: 'RL-2026-ABC',
      token: 'tok-1',
    });
  });

  it('extrai protocolo, container e versao do JSON legado', () => {
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

  it('decodifica payload gate antigo em base64', () => {
    const inner = JSON.stringify({
      protocolo: 'RL-1',
      token: 'abc',
      validade: '2099-01-01T00:00:00.000Z',
      clienteId: 'c1',
      containerNumero: 'MSKU1234567',
    });
    const b64 = Buffer.from(inner).toString('base64');
    expect(parseQrCredencialPayload(b64)).toEqual({
      protocolo: 'RL-1',
      token: 'abc',
      container: 'MSKU1234567',
    });
  });

  it('retorna null para payload inválido', () => {
    expect(parseQrCredencialPayload('not-json')).toBeNull();
    expect(parseQrCredencialPayload('{}')).toBeNull();
  });
});
