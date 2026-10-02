import {
  kgFromUnknown,
  mergeCatalogoContainer,
  normalizeCapacidadeDcHc,
  normalizeCatalogoIso,
  resolveCatalogoCapacidade,
} from './catalogo-containers.util';

describe('catalogo-containers.util', () => {
  it('normaliza ISO sem máscara', () => {
    expect(normalizeCatalogoIso('SEGU 625416-7')).toBe('SEGU6254167');
  });

  it('converte pesos da porta para kg inteiros', () => {
    expect(kgFromUnknown('32500')).toBe(32500);
    expect(kgFromUnknown('3.880')).toBe(3880);
    expect(kgFromUnknown('3880 KGS')).toBe(3880);
    expect(kgFromUnknown('')).toBeNull();
  });

  it('não apaga tara/MGW quando a nova captura vem vazia', () => {
    const merged = mergeCatalogoContainer(
      { taraKg: 3880, mgwKg: 32500, tipoCodigo: 'DRYHC', tamanhoPes: '40' },
      { tipoIso: '45G1', tipoCodigo: 'DRYHC', tamanhoPes: '40' },
    );
    expect(merged.taraKg).toBe(3880);
    expect(merged.mgwKg).toBe(32500);
    expect(merged.tipoIso).toBe('45G1');
  });

  it('atualiza peso quando a porta trouxer kg novo', () => {
    const merged = mergeCatalogoContainer({ taraKg: 3800 }, { taraKg: 3880 });
    expect(merged.taraKg).toBe(3880);
  });

  it('normaliza capacidade DC/HC', () => {
    expect(normalizeCapacidadeDcHc('hc')).toBe('HC');
    expect(normalizeCapacidadeDcHc('40HC')).toBe('HC');
    expect(normalizeCapacidadeDcHc('DC')).toBe('DC');
    expect(normalizeCapacidadeDcHc('REEFER')).toBeNull();
  });

  it('resolve HC pelo código ISO da porta quando o perfil é reefer', () => {
    expect(resolveCatalogoCapacidade({ perfil: 'REEFER', tipoIso: '45R1' })).toBe('HC');
    expect(resolveCatalogoCapacidade({ perfil: 'DC', tipoIso: '45G1' })).toBe('DC');
  });
});
