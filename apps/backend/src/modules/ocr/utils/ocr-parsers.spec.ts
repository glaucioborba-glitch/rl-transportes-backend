import { parseContainerNumber, parsePlaca } from './ocr-parsers';

describe('parseContainerNumber', () => {
  it('extrai número ISO válido', () => {
    const r = parseContainerNumber('MSCU1001137');
    expect(r.numero).toBe('MSCU1001137');
    expect(r.confianca).toBeGreaterThanOrEqual(0.9);
  });

  it('corrige O por 0 nos dígitos', () => {
    const r = parseContainerNumber('MSCU1OO1137');
    expect(r.numero).toBe('MSCU1001137');
    expect(r.confianca).toBeGreaterThanOrEqual(0.7);
  });

  it('aceita espaços e hífens', () => {
    const r = parseContainerNumber('MSCU 100113-7');
    expect(r.numero).toBe('MSCU1001137');
  });
});

describe('parsePlaca', () => {
  it('reconhece Mercosul ABC1D23', () => {
    const r = parsePlaca('ABC1D23');
    expect(r.placa).toBe('ABC1D23');
    expect(r.confianca).toBeGreaterThanOrEqual(0.85);
  });

  it('reconhece formato antigo ABC1234', () => {
    const r = parsePlaca('ABC-1234');
    expect(r.placa).toBe('ABC1234');
    expect(r.confianca).toBeGreaterThanOrEqual(0.85);
  });
});
