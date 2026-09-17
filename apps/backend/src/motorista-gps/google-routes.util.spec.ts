import {
  arredondarCoordCache,
  chaveDestinoRota,
  minutosDeSegundos,
  montarEnderecoTerminal,
  parseGoogleDurationSeconds,
} from './google-routes.util';

describe('google-routes.util', () => {
  it('lê duration no formato Google (1234s)', () => {
    expect(parseGoogleDurationSeconds('1234s')).toBe(1234);
    expect(parseGoogleDurationSeconds('90.4s')).toBe(90);
    expect(parseGoogleDurationSeconds('')).toBeNull();
    expect(parseGoogleDurationSeconds('12 min')).toBeNull();
  });

  it('converte segundos em minutos arredondados', () => {
    expect(minutosDeSegundos(90)).toBe(2);
    expect(minutosDeSegundos(29)).toBe(0);
  });

  it('monta endereço do terminal', () => {
    expect(
      montarEnderecoTerminal({
        logradouro: 'Rua das Palmeiras',
        numero: '100',
        bairro: 'Centro',
        cidade: 'Itajaí',
        uf: 'SC',
        cep: '88301-000',
      }),
    ).toBe('Rua das Palmeiras, 100, Centro, Itajaí - SC, 88301-000');
    expect(montarEnderecoTerminal({})).toBeNull();
  });

  it('arredonda coordenada para cache (~11 m)', () => {
    expect(arredondarCoordCache(-26.90712)).toBe('-26.9071');
  });

  it('chave de cache distingue destinos', () => {
    expect(chaveDestinoRota({ kind: 'latLng', lat: -26.9, lng: -48.66 })).not.toBe(
      chaveDestinoRota({ kind: 'address', address: 'Itajaí - SC' }),
    );
  });
});
