import {
  activateQr,
  clampQrValidadeHoras,
  deactivateQr,
  issueQrInactive,
  qrEstaAtivo,
  serializeQrUnificado,
} from './operacao-fluxo-qr.util';

describe('operacao-fluxo-qr.util', () => {
  it('issueQrInactive gera token e deixa inativo; activate reusa o mesmo token', () => {
    const issued = issueQrInactive();
    expect(issued.qrToken).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(issued.qrAtivo).toBe(false);

    const activated = activateQr(issued, 24);
    expect(activated.operacaoFluxoJson.qrToken).toBe(issued.qrToken);
    expect(activated.operacaoFluxoJson.qrAtivo).toBe(true);
    expect(activated.operacaoFluxoEstado).toBe('AGUARDANDO_CHEGADA');
    expect(qrEstaAtivo(activated.operacaoFluxoJson)).toBe(true);

    const again = deactivateQr(activated.operacaoFluxoJson);
    expect(again.qrToken).toBe(issued.qrToken);
    expect(again.qrAtivo).toBe(false);
    expect(qrEstaAtivo(again)).toBe(false);
  });

  it('serializeQrUnificado emite só protocolo e token', () => {
    expect(JSON.parse(serializeQrUnificado('RL-1', 'tok'))).toEqual({
      protocolo: 'RL-1',
      token: 'tok',
    });
  });

  it('clampQrValidadeHoras limita 1–168', () => {
    expect(clampQrValidadeHoras(0)).toBe(1);
    expect(clampQrValidadeHoras(24)).toBe(24);
    expect(clampQrValidadeHoras(999)).toBe(168);
    expect(clampQrValidadeHoras('x')).toBe(24);
  });
});
