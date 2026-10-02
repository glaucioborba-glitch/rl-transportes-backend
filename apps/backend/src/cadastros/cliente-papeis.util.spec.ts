import { defaultClientePapeis, normalizeClientePapeis, clienteTemPapelTransportador } from './cliente-papeis.util';

describe('cliente-papeis.util', () => {
  it('normaliza e ordena papéis conhecidos', () => {
    expect(normalizeClientePapeis(['transportador', 'CLIENTE', 'outro'])).toEqual([
      'CLIENTE',
      'TRANSPORTADOR',
    ]);
  });

  it('assume Cliente quando a lista vem vazia', () => {
    expect(defaultClientePapeis([])).toEqual(['CLIENTE']);
    expect(defaultClientePapeis(['TRANSPORTADOR'])).toEqual(['TRANSPORTADOR']);
  });

  it('detecta papel Transportador', () => {
    expect(clienteTemPapelTransportador(['CLIENTE', 'TRANSPORTADOR'])).toBe(true);
    expect(clienteTemPapelTransportador(['CLIENTE'])).toBe(false);
  });
});
