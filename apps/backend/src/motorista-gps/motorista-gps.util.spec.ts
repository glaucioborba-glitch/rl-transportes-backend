import { MotoristaGpsOrigem } from '@prisma/client';
import {
  assertLatLng,
  motoristaGpsEstaOnline,
  pinLocalizacaoConfere,
  pinLocalizacaoFromCpf,
  rotuloOrigemGps,
} from './motorista-gps.util';

describe('motorista-gps.util', () => {
  it('PIN são os 4 últimos dígitos do CPF', () => {
    expect(pinLocalizacaoFromCpf('123.456.789-09')).toBe('8909');
    expect(pinLocalizacaoConfere('12345678909', '8909')).toBe(true);
    expect(pinLocalizacaoConfere('12345678909', '0000')).toBe(false);
  });

  it('online só com ping recente e rastreando', () => {
    const now = new Date('2026-09-15T12:00:00Z');
    expect(motoristaGpsEstaOnline(new Date('2026-09-15T11:59:30Z'), true, now)).toBe(true);
    expect(motoristaGpsEstaOnline(new Date('2026-09-15T11:50:00Z'), true, now)).toBe(false);
    expect(motoristaGpsEstaOnline(new Date('2026-09-15T11:59:30Z'), false, now)).toBe(false);
  });

  it('rejeita coordenada fora do globo', () => {
    expect(() => assertLatLng(-91, 0)).toThrow(/fora/);
    expect(assertLatLng(-26.9, -48.66)).toEqual({ lat: -26.9, lng: -48.66 });
  });

  it('rótulo da origem', () => {
    expect(rotuloOrigemGps(MotoristaGpsOrigem.INTERNO)).toBe('Interno');
    expect(rotuloOrigemGps(MotoristaGpsOrigem.TERCEIRO)).toBe('Terceiro');
  });
});
