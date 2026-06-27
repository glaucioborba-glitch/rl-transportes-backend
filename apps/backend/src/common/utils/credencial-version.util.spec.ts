import {
  containerIsosChanged,
  deltasInvalidateQrCredential,
} from './credencial-version.util';

describe('credencial-version.util', () => {
  it('invalida QR quando placa ou motorista mudam', () => {
    expect(
      deltasInvalidateQrCredential([
        { campo: 'placaCavalo', label: 'Placa Cavalo', antes: 'A', depois: 'B' },
      ]),
    ).toBe(true);
    expect(
      deltasInvalidateQrCredential([
        { campo: 'dataRef', label: 'Data', antes: '2026-01-01', depois: '2026-01-02' },
      ]),
    ).toBe(false);
  });

  it('detecta mudança na lista de ISOs', () => {
    expect(containerIsosChanged(['MSKU1234567'], ['MSKU7654321'])).toBe(true);
    expect(containerIsosChanged(['MSKU1234567'], ['MSKU1234567'])).toBe(false);
  });
});
